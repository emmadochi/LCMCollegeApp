import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/course_model.dart';

class CourseRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<List<CourseModel>> getCourses() {
    return _firestore.collection('courses').snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => CourseModel.fromMap(doc.data(), doc.id)).toList();
    });
  }

  Stream<List<CourseModel>> getFeaturedCourses() {
    return _firestore
        .collection('courses')
        .where('isFeatured', isEqualTo: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => CourseModel.fromMap(doc.data(), doc.id)).toList();
    });
  }

  Stream<List<CourseModel>> getCoursesByCategory(String category) {
    return _firestore
        .collection('courses')
        .where('category', isEqualTo: category)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => CourseModel.fromMap(doc.data(), doc.id)).toList();
    });
  }

  Future<CourseModel> getCourseById(String courseId) async {
    final doc = await _firestore.collection('courses').doc(courseId).get();
    if (!doc.exists) throw Exception('Course not found');
    return CourseModel.fromMap(doc.data()!, doc.id);
  }
}
