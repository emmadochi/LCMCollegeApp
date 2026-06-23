<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/security.php';

// Handle CORS
handle_cors();

// Set appropriate headers
header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetCategories($conn);
        break;

    case 'POST':
        handleCreateOrUpdateCategory($conn);
        break;

    case 'DELETE':
        handleDeleteCategory($conn);
        break;

    default:
        header("HTTP/1.1 405 Method Not Allowed");
        echo json_encode(["message" => "Method not allowed. Use GET, POST or DELETE."]);
        break;
}

/**
 * Fetch categories list
 */
function handleGetCategories($conn) {
    try {
        $stmt = $conn->prepare("SELECT id, name, icon FROM categories ORDER BY name ASC");
        $stmt->execute();
        $categories = $stmt->fetchAll();

        $formattedCategories = [];
        foreach ($categories as $cat) {
            $formattedCategories[] = [
                "id" => (string)$cat['id'],
                "name" => escape_output($cat['name']),
                "icon" => escape_output($cat['icon'] ?: 'category')
            ];
        }

        echo json_encode($formattedCategories);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to retrieve categories due to an internal server error.");
    }
}

/**
 * Add or update category
 */
function handleCreateOrUpdateCategory($conn) {
    // Requires admin privileges
    $currentUser = require_auth(['admin', 'coordinator']);

    $inputData = json_decode(file_get_contents("php://input"), true);
    $id = sanitize_input($inputData['id'] ?? '');
    $name = sanitize_input($inputData['name'] ?? '');
    $icon = sanitize_input($inputData['icon'] ?? 'category');

    if (empty($name)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Category name is required."]);
        exit();
    }

    try {
        if (!empty($id)) {
            // Update
            $stmt = $conn->prepare("UPDATE categories SET name = ?, icon = ? WHERE id = ?");
            $stmt->execute([$name, $icon, $id]);
            echo json_encode(["message" => "Category updated successfully."]);
        } else {
            // Insert
            $stmt = $conn->prepare("INSERT INTO categories (name, icon) VALUES (?, ?)");
            $stmt->execute([$name, $icon]);
            echo json_encode(["message" => "Category created successfully.", "id" => $conn->lastInsertId()]);
        }
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to save category due to an internal server error.");
    }
}

/**
 * Delete category
 */
function handleDeleteCategory($conn) {
    // Requires admin privileges
    $currentUser = require_auth(['admin', 'coordinator']);

    $id = $_GET['id'] ?? '';

    if (empty($id)) {
        header("HTTP/1.1 400 Bad Request");
        echo json_encode(["message" => "Category ID is required."]);
        exit();
    }

    try {
        $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Category deleted successfully."]);
    } catch (Exception $e) {
        secure_error_handler($e, "Failed to delete category due to an internal server error.");
    }
}
