# Wargames validation CI trigger

This documentation-only change exists to trigger the repository validation workflow after the Wargames contract PRs landed.

Expected validation surface:

```bash
npm test
npm run validate
npm run validate:wargames
```

No runtime behavior, schema semantics, examples, or validator logic are changed by this file.
