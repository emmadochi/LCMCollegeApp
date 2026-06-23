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
      courseId: map['courseId'] ?? map['course_id'] ?? '',
      title: map['title'] ?? '',
      contentUrl: map['contentUrl'] ?? map['content_url'] ?? '',
      contentType: map['contentType'] ?? map['content_type'] ?? 'video',
      videoSource: map['videoSource'] ?? map['video_source'],
      moduleId: map['moduleId'] ?? map['module_id'],
      notes: map['notes'],
      order: map['order'] is int 
          ? map['order'] 
          : (map['order_index'] is int 
              ? map['order_index'] 
              : int.tryParse(map['order']?.toString() ?? map['order_index']?.toString() ?? '0') ?? 0),
      hasQuiz: map['hasQuiz'] == null || map['hasQuiz'] == true || map['hasQuiz'] == 1 || map['hasQuiz'] == '1',
    );
  }
}
