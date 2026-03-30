import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models/user_model.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../../../core/services/notification_service.dart';

class AuthRepositoryImpl implements AuthRepository {
  final FirebaseAuth _firebaseAuth;
  final FirebaseFirestore _firestore;

  AuthRepositoryImpl(this._firebaseAuth, this._firestore);

  @override
  Stream<User?> get authStateChanges => _firebaseAuth.authStateChanges();

  @override
  Future<UserModel?> signIn(String email, String password) async {
    final credential = await _firebaseAuth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    if (credential.user != null) {
      final user = await getCurrentUser();
      if (user != null) {
        await _saveFcmToken(user.id);
      }
      return user;
    }
    return null;
  }

  @override
  Future<UserModel?> signInWithGoogle() async {
    final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) return null;

    final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
    final AuthCredential credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );

    final UserCredential userCredential = await _firebaseAuth.signInWithCredential(credential);
    return _handleUserAfterSocialLogin(userCredential);
  }

  @override
  Future<UserModel?> signInWithLinkedIn() async {
    throw UnimplementedError('LinkedIn login requires a custom OAuth setup or a third-party API that is not yet configured.');
  }

  Future<UserModel?> _handleUserAfterSocialLogin(UserCredential userCredential) async {
    if (userCredential.user != null) {
      final doc = await _firestore.collection('users').doc(userCredential.user!.uid).get();
      if (!doc.exists) {
        final userModel = UserModel(
          id: userCredential.user!.uid,
          email: userCredential.user!.email ?? '',
          fullName: userCredential.user!.displayName ?? 'Social User',
        );
        await _firestore.collection('users').doc(userModel.id).set(userModel.toMap());
        await _saveFcmToken(userModel.id);
        return userModel;
      } else {
        final userModel = UserModel.fromMap(doc.data()!);
        await _saveFcmToken(userModel.id);
        return userModel;
      }
    }
    return null;
  }

  @override
  Future<UserModel?> signUp(String email, String password, String fullName) async {
    final credential = await _firebaseAuth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    if (credential.user != null) {
      final userModel = UserModel(
        id: credential.user!.uid,
        email: email,
        fullName: fullName,
      );
      await _firestore.collection('users').doc(userModel.id).set(userModel.toMap());
      await _saveFcmToken(userModel.id);
      return userModel;
    }
    return null;
  }

  @override
  Future<void> signOut() async {
    await _firebaseAuth.signOut();
  }

  @override
  Future<void> resetPassword(String email) async {
    await _firebaseAuth.sendPasswordResetEmail(email: email);
  }

  @override
  Future<UserModel?> getCurrentUser() async {
    final user = _firebaseAuth.currentUser;
    if (user != null) {
      final doc = await _firestore.collection('users').doc(user.uid).get();
      if (doc.exists) {
        return UserModel.fromMap(doc.data()!);
      }
    }
    return null;
  }
  
  @override
  Future<void> enrollInCourse(String userId, String courseId) async {
    await _firestore.collection('users').doc(userId).update({
      'enrolledCourses': FieldValue.arrayUnion([courseId])
    });
  }

  @override
  Future<void> updateProfile({String? fullName, String? profileImageUrl}) async {
    final user = _firebaseAuth.currentUser;
    if (user != null) {
      final updates = <String, dynamic>{};
      if (fullName != null) updates['fullName'] = fullName;
      if (profileImageUrl != null) updates['profileImageUrl'] = profileImageUrl;
      
      if (updates.isNotEmpty) {
        await _firestore.collection('users').doc(user.uid).update(updates);
      }
    }
  }

  @override
  Future<String> uploadProfileImage(String userId, List<int> bytes, String fileName) async {
    final storageRef = FirebaseStorage.instance.ref();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final fileRef = storageRef.child('profile_images/$userId/${timestamp}_$fileName');
    
    await fileRef.putData(Uint8List.fromList(bytes));
    return await fileRef.getDownloadURL();
  }

  Future<void> _saveFcmToken(String userId) async {
    final token = await NotificationService().getToken();
    if (token != null) {
      await _firestore.collection('users').doc(userId).set({
        'fcmToken': token,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    }
  }
}
