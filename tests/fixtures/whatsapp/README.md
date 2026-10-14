All sender names, timestamps, URLs and messages in these fixtures are synthetic.
They validate documented syntax. New YY fixtures use only the bracketed numeric
structure verified locally in an iPhone export; no private values were copied.

`dmy-24h.txt` has seven messages, two sender labels (Mira: four; Rowan: three),
one system event, two exact media omission markers, two HTTP(S) links, and five
RGI emoji graphemes across three messages. Three dates have recorded messages:
2025-03-14 (three), 2025-03-15 (two), and 2025-03-17 (two). The earliest/latest
message values are 2025-03-14T09:01 and 2025-03-17T08:01. The observed wall-clock
span is 255,600 seconds; the inclusive calendar span is four days. The longest
displayed-time gap is 165,300 seconds, from March 15 10:05 to March 17 08:00.
The longest consecutive recorded-day streak is two days (March 14–15).

`mdy-12h-ios.txt` exercises bracketed numeric month/day/four-digit-year headers,
English AM/PM, explicit second precision, and continuation lines.

`mdy-yy-ios.txt` exercises a synthetic preamble, month/day/two-digit-year headers,
midnight/noon, mixed minute/second precision and multiline content. Its three
messages have two synthetic sender labels. The fixed century rule maps YY to
2000 + YY; no timezone is inferred.

`dmy-yy-ios.txt` exercises day/month/two-digit-year headers with unambiguous day
values and two synthetic records.

`ios-de-markers.txt` contains only exact verified German marker literals in a
wholly synthetic chat: six omitted-media kinds, a deleted-message marker, one
call marker and one bounded location marker using only synthetic `0,0` fields.
A filename-bearing document suffix stays unclassified and is reported only as
an aggregate unsupported-marker count. These markers do not establish attachment
contents, call duration/direction or why a message was deleted.
