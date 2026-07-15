-- =========================================================
-- TET Success - Admin API Migration
-- Run after supabase_admin_session_migration.sql.
-- Provides secure admin actions for GitHub Pages admin.html.
-- =========================================================

begin;

create or replace function public.tet_require_admin(input_session_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  select s.admin_user_id
  into admin_id
  from public.tet_admin_sessions s
  where s.session_token = input_session_token
    and s.expires_at > now()
  limit 1;

  if admin_id is null then
    raise exception 'Invalid admin session';
  end if;

  return admin_id;
end;
$$;

revoke all on function public.tet_require_admin(text) from public;
grant execute on function public.tet_require_admin(text) to anon, authenticated;

create or replace function public.tet_admin_update_notice(
  input_session_token text,
  input_title text,
  input_date date,
  input_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if trim(coalesce(input_message, '')) = '' then
    raise exception 'Notice message is required';
  end if;

  insert into public.tet_notice_board (notice_title, notice_date, notice_message, version, is_active)
  values (coalesce(nullif(trim(input_title), ''), 'NOTICE'), input_date, trim(input_message), 1, true)
  returning id into row_id;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'update_notice', 'tet_notice_board', row_id::text, 'Notice updated');

  return row_id;
end;
$$;

create or replace function public.tet_admin_update_motivation(
  input_session_token text,
  input_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if trim(coalesce(input_text, '')) = '' then
    raise exception 'Motivation text is required';
  end if;

  insert into public.tet_daily_motivation (motivation_text, version, is_active)
  values (trim(input_text), 1, true)
  returning id into row_id;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'update_motivation', 'tet_daily_motivation', row_id::text, 'Motivation updated');

  return row_id;
end;
$$;

create or replace function public.tet_admin_save_settings(
  input_session_token text,
  input_admin_whatsapp text,
  input_payment_link text,
  input_app_version text,
  input_github_link text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if trim(coalesce(input_admin_whatsapp, '')) = ''
    or trim(coalesce(input_payment_link, '')) = ''
    or trim(coalesce(input_app_version, '')) = ''
    or trim(coalesce(input_github_link, '')) = '' then
    raise exception 'All settings are required';
  end if;

  insert into public.tet_app_settings (
    admin_whatsapp_number,
    payment_link,
    app_version,
    github_app_link,
    premium_price,
    premium_valid_until,
    dataset_versions
  )
  values (
    trim(input_admin_whatsapp),
    trim(input_payment_link),
    trim(input_app_version),
    trim(input_github_link),
    799,
    date '2028-09-30',
    '{}'::jsonb
  )
  returning id into row_id;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'save_settings', 'tet_app_settings', row_id::text, 'Settings saved');

  return row_id;
end;
$$;

create or replace function public.tet_admin_upgrade_user(
  input_session_token text,
  input_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  update public.tet_users
  set status = 'premium'
  where id = input_user_id;

  insert into public.tet_trial_premium (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    payment_status,
    payment_verified,
    premium_activated_date,
    premium_valid_until
  )
  values (
    input_user_id,
    'premium',
    current_date,
    current_date + 6,
    'approved',
    true,
    current_date,
    date '2028-09-30'
  )
  on conflict (user_id)
  do update set
    status = 'premium',
    payment_status = 'approved',
    payment_verified = true,
    premium_activated_date = current_date,
    premium_valid_until = date '2028-09-30',
    updated_at = now();

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'upgrade_user', 'tet_trial_premium', input_user_id::text, 'User upgraded to premium');

  return true;
end;
$$;

create or replace function public.tet_admin_set_issue_status(
  input_session_token text,
  input_issue_id uuid,
  input_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if input_status not in ('solved', 'unsolved') then
    raise exception 'Invalid issue status';
  end if;

  update public.tet_issue_reports
  set issue_status = input_status,
      updated_at = now()
  where id = input_issue_id;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'set_issue_status', 'tet_issue_reports', input_issue_id::text, input_status);

  return true;
end;
$$;

create or replace function public.tet_admin_reset_progress(
  input_session_token text,
  input_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  insert into public.tet_user_progress (
    user_id,
    current_group,
    current_level,
    completed_levels,
    best_score,
    overall_progress
  )
  values (input_user_id, 'Primary', 1, '{}', 0, 0)
  on conflict (user_id)
  do update set
    current_group = 'Primary',
    current_level = 1,
    completed_levels = '{}',
    best_score = 0,
    overall_progress = 0,
    last_attempt_group = null,
    last_attempt_level = null,
    last_attempt_score = null,
    last_result = null,
    retry_lock_until = null,
    attempt_count = 0,
    updated_at = now();

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'reset_progress', 'tet_user_progress', input_user_id::text, 'Learn progress reset');

  return true;
end;
$$;

create or replace function public.tet_admin_upsert_learn_question(
  input_session_token text,
  input_id uuid,
  input_group_name text,
  input_level_no integer,
  input_subject text,
  input_chapter text,
  input_concept text,
  input_difficulty text,
  input_language text,
  input_question_text text,
  input_option_a text,
  input_option_b text,
  input_option_c text,
  input_option_d text,
  input_correct_option text,
  input_correct_answer_text text,
  input_short_explanation text,
  input_learning_objective text,
  input_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if input_id is null then
    insert into public.tet_learn_questions (
      group_name, level_no, subject, chapter, concept, difficulty, language,
      question_text, option_a, option_b, option_c, option_d, correct_option,
      correct_answer_text, short_explanation, learning_objective, status
    )
    values (
      input_group_name, input_level_no, input_subject, input_chapter, input_concept,
      input_difficulty, input_language, input_question_text, input_option_a, input_option_b,
      input_option_c, input_option_d, input_correct_option, input_correct_answer_text,
      input_short_explanation, input_learning_objective, input_status
    )
    returning id into row_id;
  else
    update public.tet_learn_questions
    set group_name = input_group_name,
        level_no = input_level_no,
        subject = input_subject,
        chapter = input_chapter,
        concept = input_concept,
        difficulty = input_difficulty,
        language = input_language,
        question_text = input_question_text,
        option_a = input_option_a,
        option_b = input_option_b,
        option_c = input_option_c,
        option_d = input_option_d,
        correct_option = input_correct_option,
        correct_answer_text = input_correct_answer_text,
        short_explanation = input_short_explanation,
        learning_objective = input_learning_objective,
        status = input_status,
        updated_at = now()
    where id = input_id
    returning id into row_id;
  end if;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'upsert_learn_question', 'tet_learn_questions', row_id::text, 'Learn question saved');

  return row_id;
end;
$$;

create or replace function public.tet_admin_disable_learn_question(
  input_session_token text,
  input_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);
  update public.tet_learn_questions set status = 'inactive', updated_at = now() where id = input_id;
  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'disable_learn_question', 'tet_learn_questions', input_id::text, 'Question disabled');
  return true;
end;
$$;

create or replace function public.tet_admin_upsert_previous_question(
  input_session_token text,
  input_id uuid,
  input_tet_year integer,
  input_exam_date date,
  input_difficulty text,
  input_subject text,
  input_question_no integer,
  input_language text,
  input_question_text text,
  input_correct_answer text,
  input_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if input_id is null then
    insert into public.tet_previous_tet_questions (
      tet_year, exam_date, difficulty, subject, question_no, language,
      question_text, correct_answer, status
    )
    values (
      input_tet_year, input_exam_date, input_difficulty, input_subject,
      input_question_no, input_language, input_question_text, input_correct_answer, input_status
    )
    returning id into row_id;
  else
    update public.tet_previous_tet_questions
    set tet_year = input_tet_year,
        exam_date = input_exam_date,
        difficulty = input_difficulty,
        subject = input_subject,
        question_no = input_question_no,
        language = input_language,
        question_text = input_question_text,
        correct_answer = input_correct_answer,
        status = input_status,
        updated_at = now()
    where id = input_id
    returning id into row_id;
  end if;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'upsert_previous_question', 'tet_previous_tet_questions', row_id::text, 'Previous TET question saved');

  return row_id;
end;
$$;

create or replace function public.tet_admin_upsert_textbook(
  input_session_token text,
  input_id uuid,
  input_subject text,
  input_chapter_name text,
  input_language text,
  input_difficulty text,
  input_reading_time_minutes integer,
  input_concept text,
  input_important_points text,
  input_formula_rule text,
  input_examples text,
  input_common_mistakes text,
  input_exam_tips text,
  input_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  row_id uuid;
begin
  admin_id := public.tet_require_admin(input_session_token);

  if input_id is null then
    insert into public.tet_digital_textbook (
      subject, chapter_name, language, difficulty, reading_time_minutes,
      concept, important_points, formula_rule, examples, common_mistakes,
      exam_tips, status
    )
    values (
      input_subject, input_chapter_name, input_language, input_difficulty,
      input_reading_time_minutes, input_concept, input_important_points,
      input_formula_rule, input_examples, input_common_mistakes, input_exam_tips,
      input_status
    )
    returning id into row_id;
  else
    update public.tet_digital_textbook
    set subject = input_subject,
        chapter_name = input_chapter_name,
        language = input_language,
        difficulty = input_difficulty,
        reading_time_minutes = input_reading_time_minutes,
        concept = input_concept,
        important_points = input_important_points,
        formula_rule = input_formula_rule,
        examples = input_examples,
        common_mistakes = input_common_mistakes,
        exam_tips = input_exam_tips,
        status = input_status,
        updated_at = now()
    where id = input_id
    returning id into row_id;
  end if;

  insert into public.tet_admin_logs (admin_user_id, action_type, table_name, record_id, note)
  values (admin_id, 'upsert_textbook', 'tet_digital_textbook', row_id::text, 'Textbook chapter saved');

  return row_id;
end;
$$;

grant execute on function public.tet_admin_update_notice(text, text, date, text) to anon, authenticated;
grant execute on function public.tet_admin_update_motivation(text, text) to anon, authenticated;
grant execute on function public.tet_admin_save_settings(text, text, text, text, text) to anon, authenticated;
grant execute on function public.tet_admin_upgrade_user(text, uuid) to anon, authenticated;
grant execute on function public.tet_admin_set_issue_status(text, uuid, text) to anon, authenticated;
grant execute on function public.tet_admin_reset_progress(text, uuid) to anon, authenticated;
grant execute on function public.tet_admin_upsert_learn_question(text, uuid, text, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.tet_admin_disable_learn_question(text, uuid) to anon, authenticated;
grant execute on function public.tet_admin_upsert_previous_question(text, uuid, integer, date, text, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.tet_admin_upsert_textbook(text, uuid, text, text, text, text, integer, text, text, text, text, text, text, text) to anon, authenticated;

commit;

