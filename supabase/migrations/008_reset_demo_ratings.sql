-- ErrandGo: remove legacy/demo ratings so production starts at zero.
-- Run once in Supabase SQL Editor AFTER 007_ratings_reviews_replies.sql.
-- This intentionally deletes existing reviews/replies so only real completed-errand reviews remain.

begin;

-- Replies depend on reviews, so remove them first.
delete from public.review_replies;

-- Remove all legacy/demo review records.
delete from public.reviews;

-- Reset every profile's aggregate rating and review count to a clean production state.
-- The rating column is the existing profile aggregate used by the app.
update public.profiles
set rating = 0,
    updated_at = now();

commit;

-- Verify the reset.
select
  (select count(*) from public.reviews) as reviews_remaining,
  (select count(*) from public.review_replies) as replies_remaining,
  (select count(*) from public.profiles where coalesce(rating, 0) <> 0) as profiles_with_nonzero_rating;
