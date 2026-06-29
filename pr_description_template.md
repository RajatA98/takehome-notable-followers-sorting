# PR Description

## Summary

This change fixes the Notable Followers table so that sorting by follower count orders accounts correctly. Descending now lists the largest accounts first and ascending lists the smallest first.

The issue was not isolated to the Followers column. The shared sorting helper was inferring the wrong data type for the column, so I addressed the inference logic itself rather than patching a single column. I also corrected a smaller, latent issue in how the descending direction was applied. All changes are contained within the generic helper, so the other tables and columns continue to behave exactly as before.

## Root Cause

Our API delivers follower counts to the frontend as text. A value such as one million arrives as the string "1000000" rather than the number 1000000.

The sorting helper attempts to auto detect whether a column holds numbers or text, but it only classified a column as numeric when the value was already a real number. Because the counts arrive as text, the helper classified the entire column as text and sorted it alphabetically. Alphabetical comparison evaluates character by character and disregards length, so "1000000" is ordered ahead of "500000" purely because it begins with a "1". The descending step then reversed that result, which placed the one million row at the bottom, beneath the five hundred thousand rows. This matched the behavior the customer reported.

In short, this was a general weakness in the helper's numeric detection. The Followers column was simply where it became visible to a customer.

## Source of Truth

I treated the actual numeric value of each follower count as the source of truth, supported by two signals already present in the project.

First, the product states the intended behavior directly on the page: "Largest should be on top." Follower counts are quantities, and one million is larger than five hundred thousand regardless of how the value is stored as text. Ordering by magnitude is the only interpretation consistent with what the column represents.

Second, the acceptance test in the repository encodes the same expectation. It requires John Crist, with one million followers, to appear at the top when sorting from the top down, and it verifies that the full column is returned in descending numeric order. Because the test described the correct behavior and the helper did not satisfy it, this confirmed that the defect was in the helper rather than in the data or the test.

## Implementation

I made the fix in `src/sortUtils.ts`, the shared helper used by every table. This is the appropriate location because the defect is in the type detection, not in the Followers column or its data. Correcting it here resolves the underlying cause once for every current and future column that arrives as numeric text, and it avoids introducing anything specific to the Followers column.

The change consists of three focused parts:

1. I added a helper that determines whether a value genuinely represents a number. It returns true for an actual number and for a text value that parses cleanly to a finite number, and false for blank values and ordinary text.

2. I updated the column type detection so that a column is classified as numeric only when every non empty value within it is numeric, and I had it evaluate all values rather than only the first. This allows the follower counts to sort by magnitude while genuine text columns such as Username and Country continue to sort alphabetically. Evaluating every value also prevents a single outlier from misclassifying an entire column.

3. I revised how the descending direction is applied. Previously the helper sorted ascending and then reversed the entire list. Reversing also inverts rows that are tied, which can cause equal rows to shift position when the direction is toggled. The helper now inverts the comparison itself for descending order, which allows the stable sort to preserve the original order of tied rows in both directions.

I did not modify the data, the test, the column definitions, or the table component.

## Regression Prevention

Several aspects of this change reduce the likelihood of the bug returning.

The fix lives in a single shared helper, so there is one clearly documented place that defines how columns are typed and sorted, rather than scattered per column patches. The accompanying comments explain why numeric text is treated as numeric and why descending inverts the comparison rather than reversing the list, so future contributors can understand the intent.

The provided test now passes and pins the expected behavior for follower counts in both directions, so any change that reintroduced alphabetical sorting would fail the suite. Beyond this change, I would add a small number of further tests to the same file to lock in the surrounding cases: that text columns such as Username and Country still sort alphabetically, that tied rows retain a stable order, and that mixed or blank values behave predictably. These cover the precise conditions that made the original defect easy to introduce.

Looking further ahead, the most durable safeguard would be to convert these values to real numbers at the point the API response enters the application, so the table layer never has to infer a type. I have noted this as a follow up rather than expanding the scope of the present fix.

# Communication

## Customer Follow-Up Message

Hello,

Thank you for reporting this, and for the clear example. It made the issue straightforward to diagnose.

You were correct. On the Notable Followers table, sorting by number of followers was ordering the accounts as though the counts were text rather than numbers, which is why an account with one million followers could appear below accounts with five hundred thousand. We have corrected this. Sorting from the top now places the largest accounts first, and sorting in the opposite direction places the smallest first, consistently across the full list.

The fix is on its way to release. Once it is live, please click the Followers header again to confirm the order looks correct on your end. If anything still appears off, or if you notice similar behavior on another table, please reply here and I will look into it. Thank you again for helping us improve this.

Best regards,
Rajat Arora

## Team Follow-Up Message

Hi team,

I wanted to share a quick summary of the Notable Followers sorting issue a customer reported, where an account with one million followers was appearing below accounts with five hundred thousand, along with the fix I have put up for review.

On the root cause: our API returns follower counts as strings, and our shared sort helper in `sortUtils.ts` only classified a column as numeric when the value was already a real number. As a result the column was detected as text and sorted alphabetically, where "1000000" precedes "500000", and the descending step then reversed that order and moved the largest value to the bottom. This was a general gap in our type detection rather than an issue specific to the Followers column.

The fix is in `sortUtils.ts` and stays generic. A column is now treated as numeric when all of its non empty values parse as numbers, and the detector evaluates every value rather than only the first, so that a single outlier cannot misclassify a column. I also replaced the reverse based descending logic with an inverted comparison, which keeps tied rows stable when the direction is toggled. The existing test passes and the other columns, including Username and Country, are unaffected.

There is one item I think is worth a broader discussion. The underlying problem is that numeric fields reach the frontend as strings, which is what forces the table to infer types in the first place. The cleaner long term solution is to parse these into real numbers when the API response enters the application, which would remove the inference for every table at once. I am happy to take this on as a separate piece of work if we feel it is worthwhile.

Please take a look at the pull request when you have a moment, and let me know if you have any questions or feedback.

Best regards,
Rajat Arora
