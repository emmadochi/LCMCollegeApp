class ApiConstants {
  // Use 10.0.2.2 for Android emulator loopback to host PC running XAMPP
  static const String baseUrl = 'https://lcmcollege.org/api';
  
  // Endpoint paths
  static const String login = '/auth/login.php';
  static const String register = '/auth/register.php';
  static const String courses = '/courses/index.php';
  static const String lessons = '/lessons/index.php';
  static const String categories = '/categories/index.php';
  static const String reviews = '/reviews/index.php';
  static const String enroll = '/learning/enroll.php';
  static const String progress = '/learning/progress.php';
  static const String certificate = '/learning/certificate.php';
  static const String assignments = '/assignments/index.php';
  static const String submissions = '/assignments/submissions.php';
  static const String quizzes = '/quizzes/index.php';
}
