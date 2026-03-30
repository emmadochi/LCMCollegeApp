import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/review_model.dart';

class ReviewRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<List<ReviewModel>> getCourseReviews(String courseId) {
    return _firestore
        .collection('reviews')
        .where('courseId', isEqualTo: courseId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) => ReviewModel.fromMap(doc.data(), doc.id)).toList();
    });
  }

  Future<void> addReview(ReviewModel review) async {
    await _firestore.collection('reviews').add(review.toMap());
  }
}
