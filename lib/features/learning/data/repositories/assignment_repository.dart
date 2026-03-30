import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../models/assignment_model.dart';

class AssignmentRepository {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;

  Stream<AssignmentModel?> getAssignmentForLesson(String lessonId) {
    return _firestore
        .collection('assignments')
        .where('lessonId', isEqualTo: lessonId)
        .snapshots()
        .map((snapshot) {
      if (snapshot.docs.isEmpty) return null;
      return AssignmentModel.fromMap(snapshot.docs.first.data(), snapshot.docs.first.id);
    });
  }

  Stream<SubmissionModel?> getUserSubmission(String assignmentId, String userId) {
    return _firestore
        .collection('assignment_submissions')
        .where('assignmentId', isEqualTo: assignmentId)
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snapshot) {
      if (snapshot.docs.isEmpty) return null;
      return SubmissionModel.fromMap(snapshot.docs.first.data(), snapshot.docs.first.id);
    });
  }

  Future<void> submitAssignment({
    required SubmissionModel submission,
    File? file,
  }) async {
    String fileUrl = submission.fileUrl;
    
    if (file != null) {
      final ref = _storage.ref().child('assignments/${submission.userId}/${DateTime.now().millisecondsSinceEpoch}_${submission.fileName}');
      await ref.putFile(file);
      fileUrl = await ref.getDownloadURL();
    }

    final finalSubmission = {
      ...submission.toMap(),
      'fileUrl': fileUrl,
    };

    await _firestore.collection('assignment_submissions').add(finalSubmission);
  }
}
