"use strict";
var util = require("./util");
var LocalStrategy = require("passport-local");
var BearerStrategy = require("passport-http-bearer-sl").Strategy;

module.exports = function(config, passport, user) {
	// API token strategy
	passport.use(
		new BearerStrategy(function(tokenPass, done) {
			var parse = tokenPass.split(":");
			if (parse.length < 2) {
				done(null, false, { message: "invalid token" });
			}
			var token = parse[0];
			var password = parse[1];
			user.confirmSession(token, password).then(
				function(theuser) {
					done(null, theuser);
				},
				function(err) {
					if (err instanceof Error) {
						done(err, false);
					} else {
						done(null, false, { message: err });
					}
				}
			);
		})
	);

	// Use local strategy
	passport.use(
		new LocalStrategy(
			{
				usernameField: config.getItem("local.usernameField") || "username",
				passwordField: config.getItem("local.passwordField") || "password",
				session: false,
				passReqToCallback: true
			},
			function(req, username, password, done) {
				user.get(username).then(
					function(theuser) {
						if (theuser) {
							// Check if the account is locked
							if (theuser.local && theuser.local.lockedUntil && theuser.local.lockedUntil > Date.now()) {
								return done(null, false, {
									error: "Unauthorized",
									message: "حسابك مغلق، نرجو المحاولة مرة أخرى بعد عدة دقايق"
								});
							}
							if (!theuser.local || !theuser.local.derived_key) {
								return done(null, false, {
									error: "Unauthorized",
									message: "اسم المستخدم أو الرمز السري غير صحيح"
								});
							}
							util.verifyPassword(theuser.local, password).then(
								function() {
									// Check if the email has been confirmed if it is required
									if (config.getItem("local.requireEmailConfirm") && !theuser.email) {
										return done(null, false, {
											error: "Unauthorized",
											message: "يجب أكمال التحقق من البريد الإلكتروني بضغط على الرابط في رسالة التحقق"
										});
									}
									// Success!!!
									return done(null, theuser);
								},
								function(err) {
									if (!err) {
										// Password didn't authenticate
										return handleFailedLogin(theuser, req, done);
									} else {
										// Hashing function threw an error
										return done(err);
									}
								}
							);
						} else {
							// user not found
							return done(null, false, {
								error: "Unauthorized",
								message: "معلومات الدخول غير صحيحة"
							});
						}
					},
					function(err) {
						// Database threw an error
						return done(err);
					}
				);
			}
		)
	);

	function handleFailedLogin(userDoc, req, done) {
		var invalid = {
			error: "Unauthorized",
			message: "اسم المستخدم أو الرمز السري غير صحيح"
		};
		return user.handleFailedLogin(userDoc, req).then(function(locked) {
			if (locked) {
				invalid.message = "تم الوصل للحدى الأقصى للمحاولات الدخول. حسابك سوف يغلق لمدة " + Math.round(config.getItem("security.lockoutTime") / 60) + " دقيقة.";
			}
			return done(null, false, invalid);
		});
	}
};
