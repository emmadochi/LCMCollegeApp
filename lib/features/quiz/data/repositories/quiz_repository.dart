import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/quiz_model.dart';

class QuizRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Future<QuizModel?> getQuizByLessonId(String lessonId) async {
    final snapshot = await _firestore
        .collection('quizzes')
        .where('lessonId', isEqualTo: lessonId)
        .limit(1)
        .get();

    if (snapshot.docs.isEmpty) return null;
    return QuizModel.fromMap(snapshot.docs.first.data(), snapshot.docs.first.id);
  }

  Future<void> submitQuizResult({
    required String userId,
    required String courseId,
    required String lessonId,
    required int score,
  }) async {
    final docId = '${userId}_${lessonId}';
    await _firestore.collection('user_progress').doc(docId).set({
      'userId': userId,
      'courseId': courseId,
      'lessonId': lessonId,
      'lastQuizScore': score,
      'isCompleted': score >= 70, // Standard pass threshold
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }
}
