import * as DS from "../src";
import { createLocalDB } from "./util";

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
            lib.failIf(body.length > 256, "Post must be at most 256 characters")
        ]
      },
      reply: {
        spec: PostSpec
      }
    }
  };
}

describe("document modelling", () => {
  const refs = createLocalDB();

  it("should define a cyclic document model", async () => {
    DS.defineOnly(refs.db, PostSpec);

    const root = await DS.useRoot(refs.db, PostSpec);

    expect(root.db).toEqual(refs.db);
    expect(root.spec).toEqual(PostSpec);
    expect(root.path).toEqual([]);
  });

  it("should reject documents that aren't among the allowed document types", async () => {
    const result = DS.useRoot(refs.db, PostSpec)
      .then(_ => _.create())
      .then(_ => _.mutate(d => ({ ...d, type: "non-existent" })));

    expect(result).rejects.toThrow();
  });

  it("should reject invalid documents", async () => {
    const body = new Array(300).fill("x").join("");

    const result = DS.useRoot(refs.db, PostSpec)
      .then(_ => _.create())
      .then(_ => _.mutate(d => ({ ...d, content: { body } })));

    expect(result).rejects.toThrow();
  });

  it("should accept valid and allowed documents", async () => {
    const root = DS.useRoot(refs.db, PostSpec);
    const body = new Array(300).fill("x").join("");

    await root
      .then(_ => _.create())
      .then(_ => _.mutate(d => ({ ...d, content: { body } })));

    const handle = await (await root).find();
    const doc = handle && (await handle.resolve());

    expect(doc && doc.content.body).toEqual(body);
  });

  it("should create a document reference under a path", async () => {});

  it("should list documents under a path", async () => {});

  it("should reject updating a document under a path with an invalid update", async () => {});

  it("should allow updating a document under a path with a valid update", async () => {});
});
