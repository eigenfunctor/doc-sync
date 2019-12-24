# DocSync

DocSync is a library that leverages Typescript and Pouchdb/CouchDB to enforce a sychronized document model between the browser and Node.js.

To learn how to use DocSync, read the documentation [here](https://eigenfunctor.io/doc-sync).

### Installation
```
# with npm
npm install @egfn/doc-sync

# with yarn
yarn add @egfn/doc-sync
```

### Usage
```typescript
import * as DS from "@egfn/doc-sync";
import PouchDB = require("pouchdb");

DS.setupPlugins(PouchDB)

async function main() {
  interface Post {
    body: string;
    reply: Post;
  }

  function PostSpec(): DS.ValidationSpec<Post> {
    return {
      type: "post",
      schema: {
        body: {
          required: true,
          validations: [
            (lib, body) =>
              lib.failIf(
                body.length > 10,
                "Post must be at most 10 characters"
              )
          ]
        },
        reply: {
          spec: PostSpec
        }
      }
    };
  }

  const db = new PouchDB(`test_db`, { adapter: "memory"  });

  // @ts-ignore
  db.installValidationMethods(); // required for local validation

  await DS.defineOnly(db, PostSpec);

  const root = DS.usePathHandle(db, PostSpec, ["feed"]);

  await root
    .then(_ => _.create())
    .then(_ => _.path.reply())
    .then(_ => _.create());

  const list = await root
    .then(_ => _.list())
    .then(_ => Promise.all(_.map(h => h.resolve())));

  const replyList = await root
    .then(_ => _.find())
    .then(_ => _ && _.path.reply())
    .then(_ => _ && _.list())
    .then(_ => _ && Promise.all(_.map(h => h.resolve())))

  console.log(list)
  console.log(replyList)
}

main();
```

### API Reference
See [here](https://eigenfunctor.io/doc-sync/globals.html).
