import { expect, test } from "bun:test";
import { contactFromValues, privateValuesOf } from "./values";

test("a new CV's contact takes the first value of each kind, links take all", () => {
  const contact = contactFromValues([
    { kind: "name", value: "Alex Moreno" },
    { kind: "email", value: "alex@example.com" },
    { kind: "email", value: "other@example.com" },
    { kind: "url", value: "github.com/alex" },
    { kind: "url", value: "alex.dev" },
    { kind: "custom", value: "Maria Santos" },
  ]);
  expect(contact).toMatchObject({
    name: "Alex Moreno",
    email: "alex@example.com",
    phone: "",
    links: ["github.com/alex", "alex.dev"],
  });
});

test("values to mask are the current contact plus the vault, without blanks or duplicates", () => {
  const values = privateValuesOf({
    contact: {
      name: "Alex Moreno",
      email: "",
      phone: "",
      location: "Porto",
      dateOfBirth: "",
      links: ["github.com/alex"],
    },
    vault: [
      { kind: "name", value: "alex  MORENO" },
      { kind: "custom", value: "Maria Santos" },
    ],
  });
  expect(values.map((v) => v.value)).toEqual([
    "Alex Moreno",
    "Porto",
    "github.com/alex",
    "Maria Santos",
  ]);
});
