/**
 * NexGen Leaders Foundation - website form handler.
 *
 * Receives the Contact, Program Application and Mentor Registration forms,
 * saves each one to the Google Sheet this script is attached to, then emails it
 * to NOTIFY_EMAIL. The row is saved first, so a failed email never loses data.
 *
 * Setup steps are in README.md under "Website Forms".
 */

var NOTIFY_EMAIL = 'info@nexgenleaders.org';
var SENDER_NAME = 'NexGen Website Forms';

var MAX_BODY_CHARS = 20000;
var MAX_FIELD_CHARS = 5000;
var MAX_PER_EMAIL_PER_HOUR = 5;
var MAX_TOTAL_PER_HOUR = 60;

var FORMS = {
    program: {
        title: 'Program Application',
        sheet: 'Program Applications',
        required: ['first_name', 'last_name', 'email', 'age', 'city', 'program', 'motivation'],
        fields: ['first_name', 'last_name', 'email', 'age', 'city', 'program', 'motivation', 'heard']
    },
    mentor: {
        title: 'Mentor Registration',
        sheet: 'Mentor Registrations',
        required: ['first_name', 'last_name', 'email', 'profession', 'experience', 'motivation'],
        fields: ['first_name', 'last_name', 'email', 'profession', 'experience', 'motivation']
    },
    contact: {
        title: 'Contact Message',
        sheet: 'Contact Messages',
        required: ['first_name', 'last_name', 'email', 'subject', 'message'],
        fields: ['first_name', 'last_name', 'email', 'organisation', 'subject', 'message']
    }
};

var LABELS = {
    first_name: 'First Name',
    last_name: 'Last Name',
    email: 'Email Address',
    age: 'Age',
    city: 'City / Town',
    program: 'Program',
    motivation: 'Motivation',
    heard: 'How They Heard About Us',
    profession: 'Profession / Industry',
    experience: 'Years of Experience',
    organisation: 'Organisation',
    subject: 'Subject',
    message: 'Message'
};

function doPost(e) {
    try {
        return respond(handleSubmission(e));
    } catch (error) {
        console.error(error);
        return respond({ ok: false, message: 'We could not process your submission.' });
    }
}

function doGet() {
    return respond({ ok: true, service: 'NexGen website forms' });
}

function handleSubmission(e) {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > MAX_BODY_CHARS) {
        return { ok: false, message: 'Your submission is too long or empty.' };
    }

    var input = JSON.parse(raw);

    // Hidden field that people never see. Report success so bots don't adapt.
    if (input.website) {
        return { ok: true };
    }

    var form = Object.prototype.hasOwnProperty.call(FORMS, input.submission_type)
        ? FORMS[input.submission_type]
        : null;
    if (!form) {
        return { ok: false, message: 'Unknown form.' };
    }

    var values = {};
    for (var i = 0; i < form.fields.length; i++) {
        var name = form.fields[i];
        values[name] = String(input[name] == null ? '' : input[name]).trim().slice(0, MAX_FIELD_CHARS);
    }

    for (var j = 0; j < form.required.length; j++) {
        if (!values[form.required[j]]) {
            return { ok: false, message: 'Please complete all required fields.' };
        }
    }

    values.email = values.email.toLowerCase();
    if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(values.email)) {
        return { ok: false, message: 'Please enter a valid email address.' };
    }

    if (isRateLimited(values.email)) {
        return { ok: false, message: 'Too many submissions. Please try again later.' };
    }

    var saved = saveRow(form, values);
    var status = sendNotification(form, values);
    saved.sheet.getRange(saved.row, form.fields.length + 2).setValue(status);

    return { ok: true };
}

function isRateLimited(email) {
    var cache = CacheService.getScriptCache();
    return !withinLimit(cache, 'total', MAX_TOTAL_PER_HOUR) ||
        !withinLimit(cache, 'email:' + email, MAX_PER_EMAIL_PER_HOUR);
}

function withinLimit(cache, key, limit) {
    var count = Number(cache.get(key) || 0);
    if (count >= limit) {
        return false;
    }
    cache.put(key, String(count + 1), 3600);
    return true;
}

function saveRow(form, values) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
        var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = spreadsheet.getSheetByName(form.sheet);

        if (!sheet) {
            sheet = spreadsheet.insertSheet(form.sheet);
            var headers = ['Received'].concat(form.fields.map(function (name) {
                return LABELS[name];
            }), ['Email Status']);
            sheet.appendRow(headers);
            sheet.setFrozenRows(1);
        }

        var row = [new Date()].concat(form.fields.map(function (name) {
            return safeCell(values[name]);
        }), ['Pending']);
        sheet.appendRow(row);

        return { sheet: sheet, row: sheet.getLastRow() };
    } finally {
        lock.releaseLock();
    }
}

// Stops submitted text from running as a spreadsheet formula.
function safeCell(value) {
    return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function sendNotification(form, values) {
    try {
        if (MailApp.getRemainingDailyQuota() < 1) {
            return 'Not sent - daily email limit reached';
        }

        var name = (values.first_name + ' ' + values.last_name).replace(/[\r\n]+/g, ' ');
        var body = form.fields.filter(function (field) {
            return values[field];
        }).map(function (field) {
            return LABELS[field] + ':\n' + values[field];
        }).join('\n\n');

        MailApp.sendEmail({
            to: NOTIFY_EMAIL,
            replyTo: values.email,
            name: SENDER_NAME,
            subject: 'New ' + form.title + ' - ' + name,
            body: body + '\n\n--\nSent from the nexgenleaders.org ' + form.title + ' form.'
        });

        return 'Sent';
    } catch (error) {
        console.error(error);
        return 'Failed - see Google Sheet row';
    }
}

function respond(result) {
    return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}
