import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/lesson_model.dart';
import '../models/progress_model.dart';

class LearningRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<List<LessonModel>> getLessons(String courseId) {
    return _firestore
        .collection('lessons')
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snapshot) {
      final lessons = snapshot.docs.map((doc) => LessonModel.fromMap(doc.data(), doc.id)).toList();
      lessons.sort((a, b) => a.order.compareTo(b.order));
      return lessons;
    });
  }

  Future<void> updateProgress(ProgressModel progress) async {
    final docId = '${progress.userId}_${progress.lessonId}';
    await _firestore.collection('user_progress').doc(docId).set(
          progress.toMap(),
          SetOptions(merge: true),
        );
  }

  Stream<List<ProgressModel>> getUserProgress(String userId, String courseId) {
    return _firestore
        .collection('user_progress')
        .where('userId', isEqualTo: userId)
        .where('courseId', isEqualTo: courseId)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => ProgressModel.fromMap(doc.data())).toList();
    });
  }

  Future<LessonModel?> getLessonById(String lessonId) async {
    final doc = await _firestore.collection('lessons').doc(lessonId).get();
    if (!doc.exists) return null;
    return LessonModel.fromMap(doc.data()!, doc.id);
  }

  Future<void> requestCertificate(String userId, String courseId) async {
    await _firestore.collection('certificate_requests').add({
      'userId': userId,
      'courseId': courseId,
      'requestedAt': FieldValue.serverTimestamp(),
      'status': 'pending',
    });
  }
}
