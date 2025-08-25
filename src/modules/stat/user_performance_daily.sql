-- Materialized view tổng hợp performance cho từng user theo ngày
CREATE MATERIALIZED VIEW user_performance_daily AS
SELECT
  u.login AS username,
  u.avatar_url AS avatar,
  DATE(c.date) AS day,
  COUNT(DISTINCT c.sha) AS commit_count,
  COUNT(DISTINCT pr.pr_id) AS pr_count,
  COUNT(DISTINCT r.review_id) AS review_count,
  COUNT(DISTINCT c.sha) + COUNT(DISTINCT pr.pr_id) * 2 + COUNT(DISTINCT r.review_id) AS performance
FROM
  (SELECT DISTINCT author_name AS login FROM commit_entity
   UNION
   SELECT DISTINCT pr_raw->'user'->>'login' FROM pull_requests
   UNION
   SELECT DISTINCT review_id FROM pull_request_reviews) u
LEFT JOIN commit_entity c ON c.author_name = u.login
LEFT JOIN pull_requests pr ON pr.pr_raw->'user'->>'login' = u.login
LEFT JOIN pull_request_reviews r ON r.review_id LIKE CONCAT('%-', u.login)
GROUP BY u.login, u.avatar_url, DATE(c.date);

-- Để cập nhật lại dữ liệu view sau khi có thay đổi, dùng:
-- REFRESH MATERIALIZED VIEW user_performance_daily;
