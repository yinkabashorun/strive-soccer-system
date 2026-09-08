-- =====================================================================
-- Strive Elite - drill demo videos
-- =====================================================================
-- Each bank drill can carry a demo video (played from the drill card via
-- "Watch demo") and an optional "demoed by" credit for the player in the
-- clip. Seeds the 14 links from the Ball Mastery Transformation Course.
-- Safe to re-run: updates only fill empty video_url values.
-- =====================================================================

alter table public.elite_drills
  add column if not exists video_url text not null default '',
  add column if not exists demo_by   text not null default '';

update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/vwzCCVyDFkTUIZfq.mp4' where title = 'Inside-outside cone weave' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/POoQopaTzkWqvXpv.mov' where title = 'La Croqueta cone weave' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/QiblJbEqVTPozDud.mp4' where title = '8-cone freestyle' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/sSDCRAmGquYZMddQ.mp4' where title = 'Ronaldinho drill' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/hTHXbVErXMeegCGE.mp4' where title = 'Figure-8 dribble' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/oFUpYSVfdHkZMtUl.MP4' where title = 'Neymar Feint' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/DwIDNpPWjIfESEPa.MP4' where title = 'Body Feint' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/rLwklYeePleghSHY.MP4' where title = 'Maradona' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/NTNYbFKFgaMEpxiA.MP4' where title = 'Mbappe Chop' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/cJyFfcoIukyYuKOl.MP4' where title = 'La Croqueta' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/LUrnPLriXaIbxhDG.mp4' where title = 'Reverse Elastico' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/fSpCzUHlZbnqCRAW.mp4' where title = 'Elastico' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/RfPrPewZZrnbhLyj.MP4' where title = 'Stepover' and video_url = '';
update public.elite_drills set video_url = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663373072550/isWTvYFmpepwbekU.mp4' where title = '1v1 freestyle' and video_url = '';
