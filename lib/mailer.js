"use strict";
var fs = require("fs");
var BPromise = require("bluebird");
var nodemailer = require("nodemailer");
var ejs = require("ejs");
var mailgunjs = require("mailgun-js");

module.exports = function(config) {
	// Initialize the transport mechanism with nodermailer
	var transporter;
	var customTransport = config.getItem("mailer.transport");
	var mailgun = mailgunjs(config.getItem("mailgun"));

	this.sendEmail = function(templateName, email, locals) {
		// load the template and parse it
		var templateFile = config.getItem("emails." + templateName + ".template");
		if (!templateFile) {
			return BPromise.reject('No template found for "' + templateName + '".');
		}
		var template = fs.readFileSync(templateFile, "utf8");
		if (!template) {
			return BPromise.reject("Failed to locate template file: " + templateFile);
		}
		var body = ejs.render(template, locals);
		// form the email
		var subject = config.getItem("emails." + templateName + ".subject");
		var format = config.getItem("emails." + templateName + ".format");
		var mailOptions = {
			from: config.getItem("mailer.fromEmail"),
			to: email,
			subject: subject
		};
		if (format === "html") {
			mailOptions.html = body;
		} else {
			mailOptions.text = body;
		}
		if (config.getItem("testMode.debugEmail")) {
			console.log(mailOptions);
		}
		// send the message
		return new Promise(function(resolve, reject) {
			mailgun.messages().send(mailOptions, function(error, res) {
				if (config.getItem("testMode.debugEmail")) {
					console.log(error, res);
				}

				if (error) reject(error);
				else resolve(res);
			});
		});
	};

	return this;
};
