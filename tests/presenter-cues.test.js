import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { PRESENTER_CUES, createCueSection } from "../src/presenter-cues.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("presenter demo choreography", () => {
  it("attaches complete scripts to existing, unique slide IDs", () => {
    const slideIds = [...html.matchAll(/<section\b[^>]*data-slide-id="([^"]+)"/g)].map(match => match[1]);
    for (const [slideId, cue] of Object.entries(PRESENTER_CUES)) {
      expect(slideIds.filter(id => id === slideId)).toHaveLength(1);
      for (const key of ["label", "duration", "show", "say", "check", "returnTo"]) expect(cue[key].length).toBeGreaterThan(0);
    }
  });

  it("renders script text as text rather than executable markup", () => {
    const document = { createElement: tag => ({ tag, children: [], append(...nodes) { this.children.push(...nodes); } }) };
    const section = createCueSection({ ...PRESENTER_CUES["install-cli"], show: "<script>example</script>" }, document);
    expect(section.children[1].children[1].textContent).toBe("<script>example</script>");
    expect(section.children[1].children.map(node => node.textContent)).toContain("Checkpoint");
  });

  it("keeps the projected cue host-only and initially hidden", () => {
    expect(html).toMatch(/<button id="demoCue"[^>]*data-host-only hidden/);
    expect(html).toContain("body.view-audience .demo-cue { display: none; }");
  });

  it("snapshots fresh decorated notes on every read without accumulating scripts", () => {
    const makeSlide = (id, title, notes) => ({ getAttribute: name => ({ "data-slide-id": id, "data-title": title, "data-cue": "6:00" })[name], querySelector: () => ({ innerHTML: notes }) });
    const eventNodes = { date: {}, doorsTime: {}, workshopTime: {}, joinLink: {} };
    const context = {
      slides: [makeSlide("install-cli", "Install", "<p>Base notes</p>"), makeSlide("authenticate-cli", "Sign in", "<p>Login notes</p>")],
      current: 0, EVENTS: { sf: { date: "city-date" } },
      state: { city: "sf", eventDate: "custom-date", doorsTime: "17:15", workshopTime: "18:00", joinLink: "https://bit.ly/test" },
      formatEventDate: value => `Date: ${value}`, formatEventTime: value => `Time: ${value}`, normalizeJoinLink: value => value,
      notesContent: { innerHTML: "", querySelectorAll: selector => {
        const key = /data-event-field="([^"]+)"/.exec(selector)?.[1];
        return key ? [eventNodes[key]] : [];
      } }
    };
    const api = runInNewContext(html.slice(html.indexOf("      var presenterNotesDecorator"), html.indexOf("      function renderSlide()")) + "({getPresenterSnapshot, setPresenterNotesDecorator})", context);
    api.setPresenterNotesDecorator((id, node) => { node.innerHTML = `<section>${id} demo</section>` + node.innerHTML; });
    const first = api.getPresenterSnapshot();
    expect(eventNodes.date.textContent).toBe("Date: custom-date");
    expect(eventNodes.doorsTime.textContent).toBe("Time: 17:15");
    expect(eventNodes.workshopTime.textContent).toBe("Time: 18:00");
    expect(eventNodes.joinLink.textContent).toBe("bit.ly/test");
    context.state.doorsTime = "17:30";
    api.getPresenterSnapshot();
    expect(eventNodes.doorsTime.textContent).toBe("Time: 17:30");
    expect(first).toMatchObject({ version: 1, slideId: "install-cli", title: "Install", position: 1, total: 2, timing: "6:00", nextTitle: "Sign in" });
    expect(api.getPresenterSnapshot().notesHtml).toBe(first.notesHtml);
    context.current = 1;
    expect(api.getPresenterSnapshot()).toMatchObject({ slideId: "authenticate-cli", position: 2, nextTitle: "", notesHtml: "<section>authenticate-cli demo</section><p>Login notes</p>" });
  });
});
