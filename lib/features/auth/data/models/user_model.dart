class UserModel {
  final String id;
  final String email;
  final String fullName;
  final String? profileImageUrl;
  final List<String> enrolledCourses;
  final List<String> completedCourses;
  final bool isAdmin;

  UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    this.profileImageUrl,
    this.enrolledCourses = const [],
    this.completedCourses = const [],
    this.isAdmin = false,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'email': email,
      'fullName': fullName,
      'profileImageUrl': profileImageUrl,
      'enrolledCourses': enrolledCourses,
      'completedCourses': completedCourses,
      'isAdmin': isAdmin,
    };
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      id: map['id'] ?? '',
      email: map['email'] ?? '',
      fullName: map['fullName'] ?? '',
      profileImageUrl: map['profileImageUrl'],
      enrolledCourses: List<String>.from(map['enrolledCourses'] ?? []),
      completedCourses: List<String>.from(map['completedCourses'] ?? []),
      isAdmin: map['isAdmin'] ?? false,
    );
  }
}
