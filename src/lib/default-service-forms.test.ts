import { describe, expect, it } from "vitest";
import { defaultSectionsForService } from "@/lib/default-service-forms";
import {
  completedTemplateIdsForAppointment,
  pendingServiceIdsForAppointment,
  type AnamnesisTemplate,
} from "@/lib/custom-forms";

describe("default service forms", () => {
  it("creates a chemical assessment for color services", () => {
    const sections = defaultSectionsForService("Avaliação para Luzes ou Morena Iluminada");
    expect(sections[1].key).toBe("quimica_capilar");
    expect(sections.flatMap((section) => section.questions).length).toBeGreaterThanOrEqual(8);
  });

  it("creates a scalp assessment for treatment services", () => {
    const sections = defaultSectionsForService("Detox do Couro Cabeludo");
    expect(sections[1].key).toBe("avaliacao_capilar");
  });

  it("creates a haircut assessment for haircut services", () => {
    const sections = defaultSectionsForService("Corte Infantil");
    expect(sections[1].key).toBe("preferencias_corte");
  });

  it("keeps a complete generic base for a new unknown service", () => {
    const sections = defaultSectionsForService("Serviço personalizado");
    expect(sections[1].key).toBe("avaliacao_servico");
    expect(sections.every((section) => section.questions.length > 0)).toBe(true);
  });
});

describe("appointment form progress", () => {
  const template = (id: string, serviceIds: string[]) =>
    ({ id, service_ids: serviceIds }) as AnamnesisTemplate;

  it("only counts forms completed for the selected appointment", () => {
    const completed = completedTemplateIdsForAppointment(
      [
        { appointment_id: "appointment-a", template_id: "form-a" },
        { appointment_id: "appointment-b", template_id: "form-b" },
      ],
      "appointment-a",
    );
    expect([...completed]).toEqual(["form-a"]);
  });

  it("returns only services whose linked form is still pending", () => {
    const templates = [template("form-a", ["service-a"]), template("form-b", ["service-b"])];
    const pending = pendingServiceIdsForAppointment(
      templates,
      [{ appointment_id: "appointment", template_id: "form-a" }],
      "appointment",
      ["service-a", "service-b"],
    );
    expect(pending).toEqual(["service-b"]);
  });
});
