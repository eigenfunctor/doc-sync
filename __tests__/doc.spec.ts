import * as PouchDB from "pouchdb";
import * as DS from "../src";
import { createLocalDB } from "./util";

interface Post {
  body: string;
  reply: Post;
  attachment: Attachment;
}

interface Attachment {
  name: string;
  file: string;
}

function PostSpec(): DS.ValidationSpec<Post> {
  return {
    type: "post",
    schema: {
      body: {
        required: true,
        validations: [
          (lib, body) =>
            lib.failIf(body.length > 10, "Post must be at most 10 characters")
        ]
      },
      reply: {
        spec: PostSpec
      },
      attachment: {
        spec: AttachmentSpec
      }
    }
  };
}

function AttachmentSpec(): DS.ValidationSpec<Attachment> {
  return {
    type: "attachment",
    schema: {
      name: {
        required: true,
        validations: [
          (lib, name) =>
            lib.failIf(
              name.length > 10,
              "Attachment name must be at most 10 characters"
            )
        ]
      }
    }
  };
}

describe("document modelling", () => {
  const refs = createLocalDB();

  it("should define a cyclic document model", async () => {
    await DS.defineOnly(refs.db, PostSpec, AttachmentSpec);

    const root = await DS.useRoot(refs.db, PostSpec);

    const selector = await root.selector();

    expect(root.db).toEqual(refs.db);
    expect(root.spec).toEqual(PostSpec);
    expect(root.path).toEqual([]);
  });

  it("should generate the correct mango query", async () => {
    const root = await DS.useRoot(refs.db, PostSpec);

    const selector = await root.selector();

    expect(selector.originDB).toEqual(await DS.getDBName(refs.db));
    expect(selector.$or).toContainEqual({ type: "post" });
    expect(selector.$or).toContainEqual({ type: "attachment" });
    expect(selector.path).toEqual([{ $gte: [""] }, { $lte: ["\ufff0"] }]);
  });

  it("should reject documents that aren't among the allowed document types", async () => {
    let failed = false;

    try {
      const _id = "error-document";
      await refs.db.put({ _id, type: "non-existent" });
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should reject invalid documents", async () => {
    const body = new Array(11).fill("x").join("");

    let failed = false;

    try {
      await DS.useRoot(refs.db, PostSpec)
        .then(_ => _.create())
        .then(_ => _.mutate(c => ({ ...(c || {}), body })));
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should accept valid and allowed documents", async () => {
    const root = DS.useRoot(refs.db, PostSpec);
    const body = new Array(10).fill("x").join("");

    const id = await root
      .then(_ => _.create())
      .then(async _ => {
        await _.mutate(c => ({ ...(c || {}), body }));
        return _.docID;
      });

    const doc = await root.then(_ => _.find(id)).then(_ => _ && _.resolve());

    expect(doc && doc.content.body).toEqual(body);
  });

  it("should create a document reference under a path", async () => {
    const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

    await root
      .then(_ => _.create())
      .then(_ => _.path.reply())
      .then(_ => _.create());

    const list = await root.then(_ => _.list());

    expect(list.length).toBe(1);

    const replyList = await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.list());

    expect(replyList && replyList.length).toBe(1);
  });

  it("should reject updating a document under a path with an invalid update", async () => {
    let failed = false;

    try {
      const body = new Array(11).fill("x").join("");

      const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

      await root
        .then(_ => _.find())
        .then(_ => _ && _.path.reply())
        .then(_ => _ && _.find())
        .then(_ => _ && _.mutate(c => ({ ...(c || {}), body })));
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should allow updating a document under a path with a valid update", async () => {
    const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

    const body = new Array(10).fill("x").join("");

    await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.find())
      .then(_ => _ && _.mutate(c => ({ ...(c || {}), body })));

    const result = await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.find())
      .then(_ => _ && _.resolve());

    expect(result && result.content.body).toEqual(body);
  });
});
