<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep timeline editing in `TimelineEditor` and pure source-second operations in `timeline-editor.ts`; the montage route owns the edited segments so preview and export share exactly the same cuts.
- Key manual timeline edits by source clips, voice duration, speed and intro durations; changing those inputs rebuilds the automatic timeline instead of applying stale clip indices.
