class LessonModel {
  final String id;
  final String courseId;
  final String title;
  final String contentUrl; // URL to video or PDF/Note content
  final String contentType; // 'video' or 'pdf'
  final String? videoSource; // 'upload' or 'link'
  final String? moduleId;
  final String? notes;
  final int order;
  final bool hasQuiz;

  LessonModel({
    required this.id,
    required this.courseId,
    required this.title,
    required this.contentUrl,
    required this.contentType,
    this.videoSource,
    this.moduleId,
    this.notes,
    required this.order,
    this.hasQuiz = true,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'courseId': courseId,
      'title': title,
      'contentUrl': contentUrl,
      'contentType': contentType,
      'videoSource': videoSource,
      'moduleId': moduleId,
      'notes': notes,
      'order': order,
      'hasQuiz': hasQuiz,
    };
  }

  factory LessonModel.fromMap(Map<String, dynamic> map, String id) {
    return LessonModel(
      id: id,
      courseId: map['courseId'] ?? '',
      title: map['title'] ?? '',
      contentUrl: map['contentUrl'] ?? '',
      contentType: map['contentType'] ?? 'video',
      videoSource: map['videoSource'],
      moduleId: map['moduleId'],
      notes: map['notes'],
      order: map['order'] ?? 0,
      hasQuiz: map['hasQuiz'] ?? true,
    );
  }
}
