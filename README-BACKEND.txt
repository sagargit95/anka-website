ANKA: STUDENT ACCOUNTS + ADMIN PANEL  (setup in 5 minutes)

Needs: cPanel (or any Apache/LiteSpeed) hosting with PHP 7.4+ and the SQLite extension
(pdo_sqlite). Almost every host has it. No database to create.

1. Open  api/config.php  and change:
     setup_token   -> a long secret phrase only you know (e.g. 5 random words)
     notify_email  -> where you want "new booking" emails
2. Upload the whole folder to public_html (include the hidden .htaccess files).
3. Visit  https://nsagar.com.np/admin/setup.php
   Enter the setup token, choose your admin username + password (10+ chars).
4. Delete  admin/setup.php  from the server.
5. Log in any time at  https://nsagar.com.np/admin/

WHAT STUDENTS DO
   register.html  -> create account   |  login.html -> log in
   account.html   -> book a demo / enrol, see status, cancel pending bookings
WHAT YOU DO (admin panel)
   Bookings   : filter/search, set status (Pending / Confirmed / Completed / Cancelled),
                private notes, call / WhatsApp / email links, CSV export
   Students   : all registered students, reset a forgotten password (temporary one
                is shown once), delete a student
   Inquiries  : requests from the public contact form, mark handled
   Account    : change your admin password

BACKUPS: data lives in api/data/anka-*.sqlite. Download it from File Manager now and
then, or use the Export CSV buttons.
SAFER: in api/config.php you can set db_path to a folder OUTSIDE public_html,
e.g. '/home/CPANELUSER/anka-data/anka.sqlite' (create the folder first).
Not on Apache (e.g. Nginx)? Then you MUST do this, because .htaccess rules are ignored.
