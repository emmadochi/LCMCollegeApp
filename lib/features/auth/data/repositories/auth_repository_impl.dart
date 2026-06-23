import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/services/api_client.dart';
import '../../../../core/constants/api_constants.dart';
import '../models/user_model.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final ApiClient _apiClient;
  final SharedPreferences _prefs;
  final StreamController<UserModel?> _authStreamController = StreamController<UserModel?>.broadcast();
  UserModel? _currentUser;

  AuthRepositoryImpl(this._apiClient, this._prefs) {
    _init();
  }

  void _init() {
    final userJson = _prefs.getString('user');
    final token = _prefs.getString('token');
    
    if (token != null && userJson != null) {
      try {
        final Map<String, dynamic> userMap = jsonDecode(userJson);
        _currentUser = UserModel(
          id: userMap['id'] ?? '',
          email: userMap['email'] ?? '',
          fullName: userMap['name'] ?? userMap['fullName'] ?? '',
          isAdmin: userMap['role'] == 'admin' || userMap['isAdmin'] == true,
        );
        _authStreamController.add(_currentUser);
      } catch (e) {
        _clearLocalSession();
      }
    } else {
      _clearLocalSession();
    }
  }

  void _clearLocalSession() {
    _currentUser = null;
    _prefs.remove('token');
    _prefs.remove('user');
    _authStreamController.add(null);
  }

  @override
  Stream<UserModel?> get authStateChanges {
    // Return a stream that starts with the current cached user, then yields updates
    return Stream.value(_currentUser).concatWith([_authStreamController.stream]);
  }

  @override
  Future<UserModel?> signIn(String email, String password) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.login,
        body: {'email': email, 'password': password},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'] as String;
        final userMap = data['user'] as Map<String, dynamic>;

        // Map backend parameters to Dart domain model fields
        final userModel = UserModel(
          id: userMap['id'] ?? '',
          email: userMap['email'] ?? '',
          fullName: userMap['name'] ?? '',
          isAdmin: userMap['role'] == 'admin',
        );

        // Store session tokens
        await _prefs.setString('token', token);
        await _prefs.setString('user', jsonEncode(userMap));
        
        _currentUser = userModel;
        _authStreamController.add(userModel);
        
        return userModel;
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['message'] ?? 'Authentication failed.');
      }
    } catch (e) {
      throw Exception('Login failed: ${e.toString()}');
    }
  }

  @override
  Future<UserModel?> signUp(String email, String password, String fullName) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.register,
        body: {'name': fullName, 'email': email, 'password': password},
      );

      if (response.statusCode == 201) {
        // Automatically sign in upon registration
        return await signIn(email, password);
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['message'] ?? 'Registration failed.');
      }
    } catch (e) {
      throw Exception('Registration failed: ${e.toString()}');
    }
  }

  @override
  Future<void> signOut() async {
    _clearLocalSession();
  }

  @override
  Future<UserModel?> getCurrentUser() async {
    return _currentUser;
  }

  @override
  Future<void> resetPassword(String email) async {
    // REST implementation of password reset if built later, otherwise no-op for local databases
    throw UnimplementedError('Password reset is not implemented on local SQL databases.');
  }

  @override
  Future<void> enrollInCourse(String userId, String courseId) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.enroll,
        body: {'courseId': courseId},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final List<String> enrolled = List<String>.from(data['enrolledCourses'] ?? []);

        if (_currentUser != null) {
          final updatedUser = UserModel(
            id: _currentUser!.id,
            email: _currentUser!.email,
            fullName: _currentUser!.fullName,
            profileImageUrl: _currentUser!.profileImageUrl,
            enrolledCourses: enrolled,
            completedCourses: _currentUser!.completedCourses,
            isAdmin: _currentUser!.isAdmin,
          );

          _currentUser = updatedUser;
          _authStreamController.add(updatedUser);

          final userJson = _prefs.getString('user');
          if (userJson != null) {
            final Map<String, dynamic> userMap = jsonDecode(userJson);
            userMap['enrolledCourses'] = enrolled;
            await _prefs.setString('user', jsonEncode(userMap));
          }
        }
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['message'] ?? 'Failed to enroll in course');
      }
    } catch (e) {
      throw Exception('Enrollment failed: ${e.toString()}');
    }
  }

  @override
  Future<void> completeCourse(String userId, String courseId) async {
    // Local DB progress tracking to be integrated
  }

  @override
  Future<void> updateProfile({String? fullName, String? profileImageUrl}) async {
    // Local DB profile updates to be integrated
  }

  @override
  Future<String> uploadProfileImage(String userId, List<int> bytes, String fileName) async {
    // Secure API file uploading integration
    return '';
  }

  @override
  Future<UserModel?> signInWithGoogle() async {
    throw UnimplementedError('Google Sign-In is not supported on self-hosted local SQL database.');
  }
}

/**
 * Helper extension to prepend initial value to a stream
 */
extension StreamConcat<T> on Stream<T> {
  Stream<T> concatWith(List<Stream<T>> otherStreams) {
    final controller = StreamController<T>();
    List<StreamSubscription<T>> subscriptions = [];

    void start() {
      int currentStreamIndex = 0;
      List<Stream<T>> allStreams = [this, ...otherStreams];

      void listenToNext() {
        if (currentStreamIndex >= allStreams.length) {
          controller.close();
          return;
        }

        final currentStream = allStreams[currentStreamIndex];
        final sub = currentStream.listen(
          (data) => controller.add(data),
          onError: (e, st) => controller.addError(e, st),
          onDone: () {
            currentStreamIndex++;
            listenToNext();
          },
        );
        subscriptions.add(sub);
      }

      listenToNext();
    }

    controller.onListen = start;
    controller.onCancel = () {
      for (var sub in subscriptions) {
        sub.cancel();
      }
    };

    return controller.stream;
  }
}
