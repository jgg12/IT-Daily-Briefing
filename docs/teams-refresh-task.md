# Teams refresh: Claude scheduled task

The GitHub Action can't read Teams (that would need a stored Microsoft token).
Instead, a Claude scheduled task reads the channel through the approved
Microsoft 365 connector and commits `data/teams.json`. The commit triggers the
Action, which deploys the private site.

**Schedule:** every day at 4:40 AM Eastern (before the 5:00 AM refresh).

**Set up after the psu-cei repo exists** (the task needs push access to it).

## Task prompt (paste when creating the scheduled task)

> Update data/teams.json in the psu-cei/[REPO-NAME] repository.
>
> 1. Through the Microsoft 365 connector, list the top-level messages in the
>    Campus IDs team, General channel (team id
>    3ea5f2d0-16cf-41cf-adc2-45b394ac7d85, channel id
>    19:c12232a69f874a04b9134c66c9ffab23@thread.tacv2).
> 2. Keep only real posts (messageType "message") created in the past 7 days,
>    America/New_York time.
> 3. For each post write: date (createdDateTime, ISO 8601), title (the subject;
>    if there is no subject, the first line of the post as plain text, cut to
>    100 characters), and url (the post's webUrl). Nothing else: no authors,
>    no message text, no attachments.
> 4. Skip any post that names a student or mentions grades or student records.
> 5. Write the file in this shape, newest first, and commit it to main with the
>    message "Update Teams posts":
>    { "generated": "<now, ISO 8601>", "source": "Campus IDs > General (Microsoft 365 connector)", "items": [ ... ] }
> 6. Never scrape Teams in a browser. If the connector fails, leave the file
>    unchanged and report the error.
