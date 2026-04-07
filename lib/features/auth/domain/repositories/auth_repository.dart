import 'package:firebase_auth/firebase_auth.dart';
import '../../data/models/user_model.dart';

abstract class AuthRepository {
  Stream<User?> get authStateChanges;
  Future<UserModel?> signIn(String email, String password);
  Future<UserModel?> signInWithGoogle();
  Future<UserModel?> signUp(String email, String password, String fullName);
  Future<void> signOut();
  Future<void> resetPassword(String email);
  Future<UserModel?> getCurrentUser();
  Future<void> enrollInCourse(String userId, String courseId);
  Future<void> completeCourse(String userId, String courseId);
  Future<void> updateProfile({String? fullName, String? profileImageUrl});
  Future<String> uploadProfileImage(String userId, List<int> bytes, String fileName);
}
