import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../../core/constants/api_constants.dart';
import '../models/category_model.dart';

class CategoryRepository {
  Stream<List<CategoryModel>> getCategories() {
    return Stream.fromFuture(_fetchCategories());
  }

  Future<List<CategoryModel>> _fetchCategories() async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrl}${ApiConstants.categories}');
      final response = await http.get(uri);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => CategoryModel.fromMap(json, json['id']?.toString() ?? '')).toList();
      } else {
        throw Exception('Failed to load categories: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to fetch categories: $e');
    }
  }
}
