import type { SimulationSummary, Topic } from "./types";

export const topics: Topic[] = [
  { id: "9478-forces-moments", syllabusCode: "9478", level: "H2", strand: "Foundations of Physics", name: "Forces & Moments", order: 1 },
  { id: "9478-motion-forces", syllabusCode: "9478", level: "H2", strand: "Foundations of Physics", name: "Motion & Forces", order: 2 },
  { id: "9478-projectile-motion", syllabusCode: "9478", level: "H2", strand: "Mechanics", name: "Projectile Motion", order: 3 },
  { id: "9478-gravitational-fields", syllabusCode: "9478", level: "H2", strand: "Mechanics", name: "Gravitational Fields", order: 4 },
  { id: "9478-superposition", syllabusCode: "9478", level: "H2", strand: "Waves", name: "Superposition", order: 5 },
  { id: "9478-electric-fields", syllabusCode: "9478", level: "H2", strand: "Electricity & Magnetism", name: "Electric Fields", order: 6 },
  { id: "9478-electromagnetic-forces", syllabusCode: "9478", level: "H2", strand: "Electricity & Magnetism", name: "Electromagnetic Forces", order: 7 },
  { id: "9478-quantum-physics", syllabusCode: "9478", level: "H2", strand: "Modern Physics", name: "Quantum Physics", order: 8 },
  { id: "9478-nuclear-physics", syllabusCode: "9478", level: "H2", strand: "Modern Physics", name: "Nuclear Physics", order: 9 }
];

export const simulations: SimulationSummary[] = [
  {
    id: "legacy-earth-moon",
    slug: "earth-and-moon-orbit",
    title: "Earth and Moon Orbit",
    description: "Explore orbital motion of the Earth–Moon system and how the bodies move about their common centre of mass.",
    levels: ["H2"],
    primaryTopicId: "9478-gravitational-fields",
    relatedTopicIds: [],
    status: "published"
  },
  {
    id: "legacy-double-slit",
    slug: "double-slit-interference",
    title: "Double-Slit Interference",
    description: "Visualise how changing wavelength, slit spacing and screen geometry affect a double-slit interference pattern.",
    levels: ["H1", "H2"],
    primaryTopicId: "9478-superposition",
    relatedTopicIds: [],
    status: "published"
  },
  {
    id: "legacy-photoelectric",
    slug: "photoelectric-effect",
    title: "Photoelectric Effect",
    description: "Investigate the relationship between photon energy, work function and emitted photoelectrons.",
    levels: ["H2"],
    primaryTopicId: "9478-quantum-physics",
    relatedTopicIds: [],
    status: "published"
  }
];
