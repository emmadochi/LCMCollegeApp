<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Enforce Role-Based Access Control (RBAC) - Must be Admin or Coordinator
$currentUser = require_auth(['admin', 'coordinator']);

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("HTTP/1.1 405 Method Not Allowed");
    echo json_encode(["message" => "Only POST method is allowed for file uploads."]);
    exit();
}

if (!isset($_FILES['file'])) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "No file uploaded."]);
    exit();
}

$file = $_FILES['file'];
$fileName = $file['name'];
$fileTmp = $file['tmp_name'];
$fileSize = $file['size'];
$fileError = $file['error'];

if ($fileError !== UPLOAD_ERR_OK) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Upload failed with error code: " . $fileError]);
    exit();
}

// 1. Limit file size (e.g., max 5MB for images)
if ($fileSize > 5 * 1024 * 1024) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "File size exceeds maximum limit of 5MB."]);
    exit();
}

// 2. Validate file extension (Whitelist check)
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (!in_array($fileExt, $allowedExtensions)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Invalid file extension. Allowed types: " . implode(', ', $allowedExtensions)]);
    exit();
}

// 3. Verify actual MIME type (Defense in depth against MIME-spoofing)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $fileTmp);
finfo_close($finfo);

$allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

if (!in_array($mimeType, $allowedMimeTypes)) {
    header("HTTP/1.1 400 Bad Request");
    echo json_encode(["message" => "Invalid file content. Uploaded file MIME type does not match its extension."]);
    exit();
}

try {
    // Create uploads directory if not exists
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Generate secure randomized unique filename to prevent path traversal & filename collision
    $newFileName = bin2hex(random_bytes(16)) . '.' . $fileExt;
    $destination = $uploadDir . $newFileName;

    if (move_uploaded_file($fileTmp, $destination)) {
        // Return relative path for web clients
        $relativeUrl = '../uploads/' . $newFileName;

        echo json_encode([
            "message" => "File uploaded successfully.",
            "url" => $relativeUrl
        ]);
    } else {
        header("HTTP/1.1 500 Internal Server Error");
        echo json_encode(["message" => "Failed to save uploaded file."]);
    }
} catch (Exception $e) {
    secure_error_handler($e, "Failed to upload file due to a server error.");
}
