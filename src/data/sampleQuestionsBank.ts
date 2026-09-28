import { DifficultyLevel } from '../types/game';

export interface SampleQuestion {
  question: string;
  answer: string;
  hint: string;
}

export const SAMPLE_QUESTIONS_BY_CATEGORY: Record<DifficultyLevel, SampleQuestion[]> = {
  beginner: [
    { question: 'What is the capital of France?', answer: 'Paris', hint: 'City of Light' },
    { question: 'How many days are in a leap year?', answer: '366', hint: 'February has 29' },
    { question: 'What color do you get by mixing red and blue?', answer: 'Purple', hint: 'A secondary color' },
    { question: 'Which animal is known as the King of the Jungle?', answer: 'Lion', hint: 'Big cat with a mane' },
    { question: 'How many hours are there in one day?', answer: '24', hint: 'One full Earth rotation' },
    { question: 'What is the freezing point of water in Celsius?', answer: '0', hint: 'Ice formation temperature' },
    { question: 'Which planet is closest to the Sun?', answer: 'Mercury', hint: 'Smallest terrestrial planet' },
    { question: 'What is the opposite of hot?', answer: 'Cold', hint: 'Low temperature' },
    { question: 'How many sides does a triangle have?', answer: '3', hint: 'Tri means three' },
    { question: 'What is the chemical formula for water?', answer: 'H2O', hint: 'Two hydrogen, one oxygen' },
    { question: 'Which shape has four equal sides and 90 degree angles?', answer: 'Square', hint: 'Regular quadrilateral' },
    { question: 'In which continent is the Sahara Desert located?', answer: 'Africa', hint: 'Largest hot desert' },
    { question: 'What do bees make that humans eat?', answer: 'Honey', hint: 'Sweet golden nectar' },
    { question: 'Which sense organ is used for smelling?', answer: 'Nose', hint: 'Olfactory organ' },
    { question: 'What is the primary language spoken in Spain?', answer: 'Spanish', hint: 'Español' },
    { question: 'How many minutes are in two hours?', answer: '120', hint: '60 times two' },
    { question: 'What is the largest ocean on Earth?', answer: 'Pacific Ocean', hint: 'Covers over 30% of Earth' },
    { question: 'What fruit is traditionally associated with Isaac Newton?', answer: 'Apple', hint: 'Fell from a tree' },
    { question: 'Which bird is famous for being unable to fly and swimming in Antarctica?', answer: 'Penguin', hint: 'Waddles on ice' },
    { question: 'What is 7 multiplied by 8?', answer: '56', hint: 'Basic multiplication' },
  ],
  easy: [
    { question: 'What is the capital of Japan?', answer: 'Tokyo', hint: 'Land of the Rising Sun' },
    { question: 'How many valves does a standard trumpet have?', answer: '3', hint: 'Made of brass' },
    { question: 'What is the largest internal organ in the human body?', answer: 'Liver', hint: 'It can regenerate' },
    { question: 'What year was the first web browser invented?', answer: '1990', hint: 'By Tim Berners-Lee' },
    { question: 'What is the boiling point of water in Celsius?', answer: '100', hint: 'Standard atmospheric pressure' },
    { question: 'Which currency is used in the United Kingdom?', answer: 'Pound Sterling', hint: 'Symbol is £' },
    { question: 'Who painted the Mona Lisa?', answer: 'Leonardo da Vinci', hint: 'Italian Renaissance polymath' },
    { question: 'Which musical instrument has 88 keys?', answer: 'Piano', hint: 'Acoustic keyboard instrument' },
    { question: 'What gas do plants absorb during photosynthesis?', answer: 'Carbon Dioxide', hint: 'CO2' },
    { question: 'Which country gifted the Statue of Liberty to the USA?', answer: 'France', hint: 'Late 19th century gift' },
    { question: 'What is the hardest natural mineral on Earth?', answer: 'Diamond', hint: 'Allotrope of carbon' },
    { question: 'How many players are on the field for one soccer team?', answer: '11', hint: 'Includes the goalkeeper' },
    { question: 'Which mammal is capable of sustained powered flight?', answer: 'Bat', hint: 'Order Chiroptera' },
    { question: 'What is the largest planet in our solar system?', answer: 'Jupiter', hint: 'Features the Great Red Spot' },
    { question: 'What does the Roman numeral C represent?', answer: '100', hint: 'Century root' },
    { question: 'In which sport would you perform a slam dunk?', answer: 'Basketball', hint: 'Invented by Dr. Naismith' },
    { question: 'What is the capital city of Australia?', answer: 'Canberra', hint: 'Purpose-built capital' },
    { question: 'What is the name of Sherlock Holmes assistant?', answer: 'Dr. John Watson', hint: 'Former military doctor' },
    { question: 'Which ocean lies between North America and Europe?', answer: 'Atlantic Ocean', hint: 'Second largest ocean' },
    { question: 'How many centimeters are in one meter?', answer: '100', hint: 'Metric decimal unit' },
  ],
  moderate: [
    { question: 'What is the speed of light in vacuum in km/s approximately?', answer: '300000', hint: 'Around 299,792 km/s' },
    { question: 'Which element has the chemical symbol Fe?', answer: 'Iron', hint: 'From Latin Ferrum' },
    { question: 'What was the first artificial satellite launched into orbit?', answer: 'Sputnik 1', hint: 'Launched in 1957 by USSR' },
    { question: 'Who developed the theory of general relativity?', answer: 'Albert Einstein', hint: 'Published in 1915' },
    { question: 'What is the capital city of Canada?', answer: 'Ottawa', hint: 'Located in Ontario' },
    { question: 'Which organelle is known as the powerhouse of the cell?', answer: 'Mitochondria', hint: 'Generates ATP' },
    { question: 'In computer science, what does GUI stand for?', answer: 'Graphical User Interface', hint: 'Visual interaction' },
    { question: 'Which treaty officially ended World War I in 1919?', answer: 'Treaty of Versailles', hint: 'Signed near Paris' },
    { question: 'What is the longest river in South America?', answer: 'Amazon River', hint: 'Largest by discharge volume' },
    { question: 'What type of chemical bond involves sharing electron pairs?', answer: 'Covalent Bond', hint: 'Common between non-metals' },
    { question: 'Which Greek philosopher was the tutor of Alexander the Great?', answer: 'Aristotle', hint: 'Student of Plato' },
    { question: 'What is the most abundant gas in Earth atmosphere?', answer: 'Nitrogen', hint: 'Roughly 78 percent' },
    { question: 'In computer networking, what does DNS stand for?', answer: 'Domain Name System', hint: 'Translates domain to IP' },
    { question: 'Which layer of the Earth lies directly beneath the crust?', answer: 'Mantle', hint: 'Semi-solid silicate rock' },
    { question: 'What mathematical constant is roughly equal to 2.71828?', answer: 'Euler Number e', hint: 'Base of natural log' },
    { question: 'Which architectural style features pointed arches and flying buttresses?', answer: 'Gothic', hint: 'Medieval European style' },
    { question: 'What is the scientific study of fossils called?', answer: 'Paleontology', hint: 'Ancient organisms' },
    { question: 'Which programming language was created by Guido van Rossum?', answer: 'Python', hint: 'Named after comedy troupe' },
    { question: 'What is the SI unit of electric resistance?', answer: 'Ohm', hint: 'Symbol is uppercase Omega' },
    { question: 'Which inland body of water is one of the saltiest on Earth?', answer: 'Dead Sea', hint: 'Located between Jordan & Israel' },
  ],
  hard: [
    { question: 'What is the boundary beyond which nothing escapes a black hole?', answer: 'Event Horizon', hint: 'Point of no return' },
    { question: 'Which amino acid is coded by the universal start codon AUG?', answer: 'Methionine', hint: 'Initiates translation' },
    { question: 'In cryptography, what does RSA stand for?', answer: 'Rivest Shamir Adleman', hint: 'Asymmetric encryption founders' },
    { question: 'What is the approximate half-life of Carbon-14 in years?', answer: '5730', hint: 'Radiocarbon dating benchmark' },
    { question: 'Which Byzantine emperor codified Roman law into Corpus Juris Civilis?', answer: 'Justinian I', hint: '6th century ruler' },
    { question: 'What wave phenomenon causes waves to bend around obstacles?', answer: 'Diffraction', hint: 'Wave spreading' },
    { question: 'Which enzyme synthesizes DNA molecules during replication?', answer: 'DNA Polymerase', hint: 'Replication catalyst' },
    { question: 'What is the capital city of Kazakhstan?', answer: 'Astana', hint: 'Formerly Nur-Sultan' },
    { question: 'What geometric theorem relates the sides of a right triangle?', answer: 'Pythagorean Theorem', hint: 'a^2 + b^2 = c^2' },
    { question: 'What is the deepest known location in Earth oceans?', answer: 'Challenger Deep', hint: 'In the Mariana Trench' },
    { question: 'Which astronomer formulated the three laws of planetary motion?', answer: 'Johannes Kepler', hint: 'Elliptical orbits' },
    { question: 'What is the chemical name for Vitamin C?', answer: 'Ascorbic Acid', hint: 'Water-soluble antioxidant' },
    { question: 'Which quantum principle states position and momentum cannot both be exact?', answer: 'Heisenberg Uncertainty Principle', hint: 'Werner Heisenberg 1927' },
    { question: 'Who wrote the 1845 existential philosophical work The Concept of Anxiety?', answer: 'Soren Kierkegaard', hint: 'Danish philosopher' },
    { question: 'What is the SI unit of electrical capacitance?', answer: 'Farad', hint: 'Named after Michael Faraday' },
    { question: 'Which battle in 1066 marked the Norman conquest of England?', answer: 'Battle of Hastings', hint: 'King Harold defeated' },
    { question: 'What word describes a sequence that reads the same backward as forward?', answer: 'Palindrome', hint: 'e.g. racecar or kayak' },
    { question: 'What hormone is produced by beta cells in the pancreas?', answer: 'Insulin', hint: 'Regulates glucose' },
    { question: 'Which mathematician proved polynomial equations of degree 5+ have no radical formula?', answer: 'Evariste Galois', hint: 'Galois theory' },
    { question: 'What geometric term describes the circular planetary loops in Ptolemaic astronomy?', answer: 'Epicycles', hint: 'Geocentric correction' },
  ],
  insane: [
    { question: 'What is the value of the reduced Planck constant h-bar in J*s to two decimals?', answer: '1.05e-34', hint: 'h divided by 2pi' },
    { question: 'Which conjecture states every even integer greater than 2 is the sum of two primes?', answer: 'Goldbach Conjecture', hint: 'Proposed in 1742' },
    { question: 'What is the medical term for the inability to recognize familiar human faces?', answer: 'Prosopagnosia', hint: 'Face blindness' },
    { question: 'Which hypothetical quantum particle is proposed to mediate the gravitational force?', answer: 'Graviton', hint: 'Spin-2 massless boson' },
    { question: 'What was the German high-command teleprinter cipher machine attacked by Colossus?', answer: 'Lorenz Cipher', hint: 'SZ40 and SZ42' },
    { question: 'What composite subatomic particles are made of three valence quarks?', answer: 'Baryons', hint: 'Protons and neutrons' },
    { question: 'In differential geometry, what surface has constant negative Gaussian curvature?', answer: 'Pseudosphere', hint: 'Tractroid of revolution' },
    { question: 'Which 1494 treaty divided newly discovered non-European lands between Spain and Portugal?', answer: 'Treaty of Tordesillas', hint: 'Meridian demarcation' },
    { question: 'What is the standard model gauge group for the fundamental forces?', answer: 'SU(3)xSU(2)xU(1)', hint: 'Electroweak and strong gauge group' },
    { question: 'Which ancient Aegean civilization used the undeciphered script Linear A?', answer: 'Minoan Civilization', hint: 'Bronze Age Crete' },
    { question: 'What thermodynamic quantity remains constant during a reversible adiabatic process?', answer: 'Entropy', hint: 'Isentropic transformation' },
    { question: 'What computational complexity class contains problems verifiable in polynomial time?', answer: 'NP', hint: 'Nondeterministic Polynomial time' },
    { question: 'Which enzyme unwinds the double helix ahead of the replication fork?', answer: 'DNA Helicase', hint: 'ATP-powered motor enzyme' },
    { question: 'What famous mathematical function is continuous everywhere but differentiable nowhere?', answer: 'Weierstrass Function', hint: 'Discovered in 1872' },
    { question: 'What is the capital city of the Himalayan Kingdom of Bhutan?', answer: 'Thimphu', hint: 'Nestled in the Himalayas' },
    { question: 'What linguistic term denotes a language with no demonstrable genealogical relationship?', answer: 'Language Isolate', hint: 'e.g. Basque or Korean' },
    { question: 'What is the cosmic microwave background temperature in Kelvin rounded to two decimals?', answer: '2.73', hint: 'Thermal black-body radiation' },
    { question: 'Which mineral serves as the reference point for hardness 7 on the Mohs scale?', answer: 'Quartz', hint: 'Silicon dioxide' },
    { question: 'What is the chemical formula of a truncated icosahedron carbon fullerene?', answer: 'C60', hint: 'Buckyball' },
    { question: 'What is the radius around an active galactic nucleus inside which dust evaporates?', answer: 'Sublimation Radius', hint: 'Dust destruction boundary' },
  ],
};

/**
 * Generate formatted question lines respecting exact category limits
 */
export function generateSampleQuestionText(
  category: DifficultyLevel,
  count: number,
  mode: 'single_category' | 'distribute_evenly' = 'single_category'
): string {
  const safeCount = Math.max(1, count);

  if (mode === 'distribute_evenly') {
    const categories: DifficultyLevel[] = ['beginner', 'easy', 'moderate', 'hard', 'insane'];
    const perCat = Math.max(1, Math.floor(safeCount / categories.length));
    const lines: string[] = [];

    categories.forEach((cat) => {
      const pool = SAMPLE_QUESTIONS_BY_CATEGORY[cat] || [];
      const selected = pool.slice(0, perCat);
      selected.forEach((q) => {
        lines.push(`${cat};${q.question};${q.answer};${q.hint}`);
      });
    });

    return lines.join('\n');
  }

  const pool = SAMPLE_QUESTIONS_BY_CATEGORY[category] || SAMPLE_QUESTIONS_BY_CATEGORY.moderate;
  const selected = pool.slice(0, safeCount);
  return selected.map((q) => `${q.question};${q.answer};${q.hint}`).join('\n');
}
