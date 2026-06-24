<?php
require_once __DIR__ . '/../config/config.php';

function send_transactional_email($to, $subject, $body) {
    // 1. Log the email to api/logs/emails.log for developer testing
    $logsDir = __DIR__ . '/../logs';
    if (!file_exists($logsDir)) {
        mkdir($logsDir, 0755, true);
    }
    
    $logFile = $logsDir . '/emails.log';
    $timestamp = date("Y-m-d H:i:s");
    
    $logMsg = str_repeat("=", 80) . "\n";
    $logMsg .= "TIMESTAMP: $timestamp\n";
    $logMsg .= "TO: $to\n";
    $logMsg .= "SUBJECT: $subject\n";
    $logMsg .= "BODY:\n$body\n";
    $logMsg .= str_repeat("=", 80) . "\n\n";
    
    error_log($logMsg, 3, $logFile);
    
    // 2. Send email via PHP mail()
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: LCM Ministerial College <no-reply@lcmcollege.org>\r\n";
    
    return @mail($to, $subject, $body, $headers);
}

// Predefined premium HTML templates
function get_email_template($title, $content) {
    return '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; color: #1f2937; }
            .wrapper { max-width: 600px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #2E7D32 0%, #1b5e20 100%); padding: 32px; text-align: center; }
            .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0; text-transform: uppercase; }
            .body { padding: 40px 32px; line-height: 1.6; }
            .greeting { font-size: 18px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px; }
            .text { font-size: 15px; color: #4b5563; margin-bottom: 24px; }
            .button-container { text-align: center; margin: 32px 0; }
            .button { background: linear-gradient(135deg, #7DC026 0%, #2E7D32 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2); }
            .footer { background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
            .footer a { color: #2E7D32; text-decoration: none; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header">
                <h1 class="logo">LCM Ministerial College</h1>
            </div>
            <div class="body">
                <h2 class="greeting">' . $title . '</h2>
                <div class="text">
                    ' . $content . '
                </div>
            </div>
            <div class="footer">
                <p>&copy; ' . date("Y") . ' LCM Ministerial College. All rights reserved.</p>
                <p>If you did not request this email, please ignore it or contact <a href="mailto:support@lcmcollege.org">support@lcmcollege.org</a>.</p>
            </div>
        </div>
    </body>
    </html>
    ';
}
