-- =====================================================================
-- Strive Elite - a worked CV example in College Recruiting and Academy
-- Recruiting
-- =====================================================================
-- Coach Yinka, Nov 9 2026, sending Coach Gary's own player CV: "That's
-- coach Gary's CV, use it as reference for when teaching how to build cv.
-- This helps for both college and academy."
--
-- One new page in the CV component of each course, right after the
-- one-page template: the CV laid out as Gary wrote it (experience,
-- stats, awards, links), then what to copy from it and how a player with
-- a shorter list fills the same shape. The repository is public, so
-- Gary's phone, email, date of birth and profile links are NOT here: the
-- example carries brackets where those go. Idempotent: a course that
-- already has the page, or does not exist, is left alone, so a coach's
-- later edits are never overwritten. No dates for recruiting rules, no
-- promise of a roster spot, scholarship or academy place.
-- =====================================================================

do $$
declare
  slug_ text;
  cid uuid;
  lvl int;
  lvl_name text;
  extra text;
  body text;
  base text;
begin
  base := E'Coach Gary''s CV is the standard. One page, facts only, nothing a coach has to take your word for. This is how he wrote it.\n\nTHE EXAMPLE\n\nGary Grigoryan\n[Phone] | [Email]\n[Date of birth]\n\nEXPERIENCE\nSC Fortuna Köln U19 (Germany)\n2025 to 2026, U19 Bundesliga\n\nArmenian Youth National Team (11 caps)\n2025: UEFA U19 Euro Qualifiers (3 matches, 2 starts)\n2024: UEFA U19 Euro Qualifiers (3 matches, 1 start)\n2023: UEFA U17 Euro Qualifiers (3 matches, 3 starts); UEFA U16 Development Cup (3 matches, 2 starts)\n\nVirginia Development Academy ECNL (U.S.A.)\n2018 to 2024\n\nSTATS\nPosition: CM (8)\nOther positions: CAM (10), CDM (6)\nHeight: 5''10" / 175 cm\nWeight: 165 lb / 75 kg\nDominant foot: Right\nGPA: 3.8\n\nAWARDS\n2x ECNL Mid-Atlantic All-Conference First Team\nJack Ouellette Award, VDA\n\nHIGHLIGHT VIDEO\n[Link]\n\nTRANSFERMARKT\n[Link]\n\nWHAT TO COPY\n\nThe highest level goes first. Experience runs newest and highest at the top, so the first thing a coach reads is the best thing on the page.\n\nEvery line is a fact a coach can check: the team, the league, the years. For a national team, the caps, then each tournament with matches and starts. "3 matches, 2 starts" tells a coach more than "key player" ever will.\n\nThe stats are one short block: position, other positions, height, weight, dominant foot, GPA. A coach sees in five seconds whether you fit the roster.\n\nThe position carries its number, CM (8), and the other positions follow the same way. Coaches talk in numbers.\n\nAwards are named exactly, with the league. Two real ones beat ten vague ones.\n\nThe video is a link, not a file. Check that it opens from a phone that is not yours.\n\nWHERE OURS DIFFERS FROM GARY''S\n\nHis CV has no references line. Keep ours: a coach who likes you calls your club coach, so put their number on, with their permission.\n\nHis video link sits near the bottom. On yours, put the tape link where a coach sees it first, because it is the only line most of them click.\n\nHOW YOUR CV FILLS THE SAME SHAPE\n\nNo national team or pro club yet? Then your club and your league are the top line, written the same way: team, league, years.\n\nCount what can be counted: seasons, starts, goals if you play forward, captaincy. Do not pad. A short true list reads stronger than a long soft one.\n\nIf a block would hold filler, leave the block off.';

  for slug_ in select unnest(array['college-recruiting', 'academy-recruiting']) loop
    select id into cid from public.elite_courses where slug = slug_;
    if cid is null then
      continue;
    end if;
    if exists (select 1 from public.elite_course_steps
                where course_id = cid and title = 'A worked example: Coach Gary''s CV') then
      continue;
    end if;
    select level_no, level_name into lvl, lvl_name
      from public.elite_course_steps
     where course_id = cid and title = 'The one-page CV'
     limit 1;
    if lvl is null then
      continue;
    end if;
    if slug_ = 'college-recruiting' then
      extra := E'\n\nFOR THE COLLEGE ROUTE\n\nThe GPA sits in the stats block on purpose. A college coach checks grades before film, so it is one glance away. Add your graduation year next to it.\n\nA player with no club level to show yet leads with grades and the tape link, and lets the club coach''s reference carry the rest.';
    else
      extra := E'\n\nFOR THE ACADEMY ROUTE\n\nPut your birth year on the first line, because academies run on birth years.\n\nThe Transfermarkt line is only for a player who has a profile. If you do not have one, leave the line off.';
    end if;
    body := base || extra;
    insert into public.elite_course_steps (course_id, level_no, level_name, title, body, sort)
    values (cid, lvl, lvl_name, 'A worked example: Coach Gary''s CV', body, 20);
  end loop;
end $$;
