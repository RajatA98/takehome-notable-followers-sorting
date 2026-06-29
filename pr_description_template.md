# PR Description

## Summary

This fixes the Notable Followers table so that sorting by follower count puts the biggest accounts where you expect them. Descending now shows the largest first and ascending shows the smallest first.

The real problem was not the Followers column on its own. It was the shared sorting helper guessing the wrong type for the column, so I fixed the guessing logic in one place rather than patching the single column. I also corrected a smaller, hidden issue in how the descending direction was applied. Everything stays inside the generic helper, so the other tables and columns keep working the way they did.

## Root Cause

Our API hands follower counts to the frontend as text, so a value like one million arrives as the string "1000000" rather than the number 1000000.

The sorting helper tries to auto detect whether a column holds numbers or text, and it only treated a column as numeric when the value was already a real number. Since the counts come in as text, the helper decided the whole column was text and sorted it alphabetically. Alphabetical order compares character by character and ignores length, so "1000000" lands ahead of "500000" simply because it starts with a "1". The descending step then flipped that list, which dropped the one million row all the way to the bottom, underneath the five hundred thousand rows. That is exactly what the customer saw.

So this was a general weakness in how the helper detects numbers, and the Followers column was just the place where it became visible.

## Source of Truth

I used the actual numeric value of each follower count as the source of truth, backed by two signals already in the project.

First, the product itself states the intent right on the page: "Largest should be on top." Follower counts are quantities, and a quantity of one million is plainly larger than five hundred thousand regardless of how the text happens to be stored. Sorting by magnitude is the only reading that matches what the column means.

Second, the acceptance test in the repo encodes that same expectation. It expects John Crist with one million followers to sit at the top when sorting from the top down, and it checks that the whole column comes out in descending numeric order. Because the test described the correct behavior and the helper did not meet it, that confirmed the helper was wrong rather than the data or the test.

## Implementation

I made the fix in `src/sortUtils.ts`, which is the shared helper every table uses. That is the right place because the bug lives in the type detection, not in the Followers column or its data. Fixing it here repairs the cause once for every current and future column that arrives as numeric text, and it avoids hard coding anything specific to followers.

There are three small changes:

1. I added a helper that decides whether a value is really a number. It returns true for an actual number and for a text value that cleanly parses to a finite number, and false for blanks and ordinary words.

2. I changed the column type detection so a column counts as numeric only when every non empty value in it is numeric, and I made it look across all the values instead of only the first one. This is what lets the follower counts sort by magnitude, while genuine text columns like Username and Country still sort alphabetically. Looking at every value also stops one stray entry from mislabeling a whole column.

3. I changed how the descending direction is applied. It used to sort ascending and then reverse the entire list. Reversing also flips rows that are tied, which can make equal rows jump around when you toggle direction. I now flip the comparison itself for descending, which lets the stable sort keep tied rows in their original order in both directions.

I did not touch the data, the test, the column definitions, or the table component.

## Regression Prevention

A few things make this less likely to come back.

The fix sits in the one shared helper, so there is a single, well commented place that defines how columns are typed and sorted, rather than column by column patches scattered around. The comments explain why numeric text is treated as numeric and why descending flips the comparison instead of reversing, so the next person changing this code understands the intent.

The provided test now passes and pins the expected behavior for follower counts in both directions, so a future change that reintroduces alphabetical sorting would fail the suite. Beyond this PR, I would add a few more tests to the same file to lock in the surrounding cases: that text columns like Username and Country still sort alphabetically, that tied rows keep a stable order, and that mixed or blank values behave predictably. Those guard the exact corners that made this bug easy to introduce in the first place.

Longer term, the most durable prevention is to convert these values to real numbers when the API response first enters the app, so the table layer never has to guess a type at all. I have written that up as a follow up rather than expanding the scope of this fix.

# Communication

## Customer Follow-Up Message

Hi, thanks so much for flagging this and for the clear example, it made the problem easy to track down.

You were right. On the Notable Followers table, sorting by number of followers was ordering the accounts as if the counts were text instead of numbers, which is why an account with one million followers could end up below accounts with five hundred thousand. We have corrected it. Sorting from the top now puts the largest accounts first, and sorting the other way puts the smallest first, across the whole list.

The fix is on its way out. Once it is live, please give the Followers header another click and let me know it looks right to you. If anything still seems off, or if you spot similar ordering on another table, just reply here and I will jump on it. Thanks again for helping us make this better.

Best,
Rajat

## Team Follow-Up Message

Heads up on the Notable Followers sorting bug a customer reported, where a one million follower account sorted below five hundred thousand ones.

Root cause: the API sends follower counts as strings, and our shared sort helper in `sortUtils.ts` only treated a column as numeric when the value was already a real number. So the column was detected as text and sorted alphabetically, where "1000000" comes before "500000". The descending step then reversed that, pushing the largest value to the bottom. It was a general type detection gap, not something specific to the Followers column.

Fix is in `sortUtils.ts` and stays generic. The column is now treated as numeric when all of its non empty values parse as numbers, and the detector scans every value rather than just the first so one outlier cannot mistype a column. I also replaced the reverse based descending with flipping the comparison, which keeps tied rows stable when you toggle direction. The existing test passes and other columns like Username and Country are unaffected.

One thing worth a wider conversation: the deeper issue is that numeric fields reach the frontend as strings, so the table is forced to guess types at all. The cleaner long term fix is to parse these into real numbers when the API response enters the app, which removes the guessing for every table at once. Happy to pick that up as a separate piece of work if we agree it is worth it. Shout if you want to talk through any of it.

Rajat
