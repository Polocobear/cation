// The CATION catalogue as the dashboard reads it. Written by cation/tools/build_app_data.py from
// cation/content/site.json: edit that file and run the script, not this one.

export const catalogue = {
 "status": {
  "course": "Outline published · lessons in development",
  "lab": "In development",
  "program": "Outline published"
 },
 "disciplines": [
  {
   "slug": "science",
   "name": "Science"
  },
  {
   "slug": "technology",
   "name": "Technology"
  },
  {
   "slug": "engineering",
   "name": "Engineering"
  },
  {
   "slug": "mathematics",
   "name": "Mathematics"
  }
 ],
 "subjects": [
  {
   "slug": "physics",
   "name": "Physics",
   "discipline": "science",
   "topics": [
    "Forces and motion",
    "Energy",
    "Waves and light",
    "Electricity and magnetism",
    "Particles"
   ]
  },
  {
   "slug": "chemistry",
   "name": "Chemistry",
   "discipline": "science",
   "topics": [
    "Atoms and bonding",
    "Reactions",
    "The periodic table",
    "Acids and bases"
   ]
  },
  {
   "slug": "biology",
   "name": "Biology",
   "discipline": "science",
   "topics": [
    "Cells",
    "Genetics",
    "Evolution",
    "Ecology"
   ]
  },
  {
   "slug": "earth-space",
   "name": "Earth and Space",
   "discipline": "science",
   "topics": [
    "Plate tectonics",
    "Climate systems",
    "The Solar System",
    "Stars and galaxies"
   ]
  },
  {
   "slug": "computer-science",
   "name": "Computer Science",
   "discipline": "technology",
   "topics": [
    "Binary and logic",
    "Algorithms",
    "Data structures",
    "Computer architecture"
   ]
  },
  {
   "slug": "programming",
   "name": "Programming",
   "discipline": "technology",
   "topics": [
    "Variables and control flow",
    "Functions",
    "Debugging",
    "Projects"
   ]
  },
  {
   "slug": "data-ai",
   "name": "Data and AI",
   "discipline": "technology",
   "topics": [
    "Data literacy",
    "Statistics for data",
    "Machine learning",
    "AI and society"
   ]
  },
  {
   "slug": "networks-security",
   "name": "Networks and Security",
   "discipline": "technology",
   "topics": [
    "How the internet works",
    "Encryption",
    "Cyber security",
    "Privacy"
   ]
  },
  {
   "slug": "structures-materials",
   "name": "Structures and Materials",
   "discipline": "engineering",
   "topics": [
    "Forces in structures",
    "Stress and strain",
    "Materials",
    "Failure"
   ]
  },
  {
   "slug": "mechanical-systems",
   "name": "Mechanical Systems",
   "discipline": "engineering",
   "topics": [
    "Levers and gears",
    "Mechanisms",
    "Fluids",
    "Heat engines"
   ]
  },
  {
   "slug": "electronics",
   "name": "Electronics",
   "discipline": "engineering",
   "topics": [
    "Circuits",
    "Components",
    "Sensors",
    "Microcontrollers"
   ]
  },
  {
   "slug": "design-making",
   "name": "Design and Making",
   "discipline": "engineering",
   "topics": [
    "Design process",
    "Sketching and CAD",
    "Prototyping",
    "Testing"
   ]
  },
  {
   "slug": "number-algebra",
   "name": "Number and Algebra",
   "discipline": "mathematics",
   "topics": [
    "Number systems",
    "Expressions and equations",
    "Functions",
    "Sequences"
   ]
  },
  {
   "slug": "geometry-trigonometry",
   "name": "Geometry and Trigonometry",
   "discipline": "mathematics",
   "topics": [
    "Angles and proof",
    "Transformations",
    "Trigonometry",
    "Vectors"
   ]
  },
  {
   "slug": "calculus",
   "name": "Calculus",
   "discipline": "mathematics",
   "topics": [
    "Limits",
    "Derivatives",
    "Integrals",
    "Differential equations"
   ]
  },
  {
   "slug": "statistics-probability",
   "name": "Statistics and Probability",
   "discipline": "mathematics",
   "topics": [
    "Probability",
    "Distributions",
    "Inference",
    "Data analysis"
   ]
  }
 ],
 "courses": [
  {
   "slug": "forces-and-motion",
   "title": "Forces and Motion",
   "discipline": "science",
   "subject": "physics",
   "level": "Foundations",
   "weeks": 6,
   "hours": 3,
   "summary": "Newton’s laws from the ground up. Describe motion, predict it, and test your predictions against real measurements.",
   "modules": [
    {
     "name": "Describing motion",
     "lessons": 5
    },
    {
     "name": "Forces and Newton’s laws",
     "lessons": 6
    },
    {
     "name": "Momentum and collisions",
     "lessons": 5
    },
    {
     "name": "Energy and work",
     "lessons": 5
    },
    {
     "name": "Circular motion and gravity",
     "lessons": 4
    }
   ]
  },
  {
   "slug": "chemistry-of-change",
   "title": "The Chemistry of Change",
   "discipline": "science",
   "subject": "chemistry",
   "level": "Intermediate",
   "weeks": 8,
   "hours": 3,
   "summary": "Why reactions happen, how fast they go, and where the energy goes when they do.",
   "modules": [
    {
     "name": "Atoms, ions and bonds",
     "lessons": 5
    },
    {
     "name": "Equations and the mole",
     "lessons": 6
    },
    {
     "name": "Energy in reactions",
     "lessons": 5
    },
    {
     "name": "Rates of reaction",
     "lessons": 5
    },
    {
     "name": "Equilibrium",
     "lessons": 5
    }
   ]
  },
  {
   "slug": "inside-the-particle-zoo",
   "title": "Inside the Particle Zoo",
   "discipline": "science",
   "subject": "physics",
   "level": "Advanced",
   "weeks": 6,
   "hours": 4,
   "summary": "From the atom to quarks: how physicists read the tracks in their detectors to find particles nobody had seen.",
   "modules": [
    {
     "name": "Inside the atom",
     "lessons": 4
    },
    {
     "name": "Antimatter and pair production",
     "lessons": 5
    },
    {
     "name": "Reading tracks",
     "lessons": 5
    },
    {
     "name": "Quarks and the strong force",
     "lessons": 5
    },
    {
     "name": "The Higgs and open questions",
     "lessons": 4
    }
   ]
  },
  {
   "slug": "how-computers-think",
   "title": "How Computers Think",
   "discipline": "technology",
   "subject": "computer-science",
   "level": "Foundations",
   "weeks": 6,
   "hours": 3,
   "summary": "From a single switch to a working processor. Build up logic gates, binary arithmetic and memory until a CPU makes sense.",
   "modules": [
    {
     "name": "Bits and bytes",
     "lessons": 4
    },
    {
     "name": "Logic gates",
     "lessons": 5
    },
    {
     "name": "Arithmetic in hardware",
     "lessons": 5
    },
    {
     "name": "Memory and state",
     "lessons": 4
    },
    {
     "name": "Inside the CPU",
     "lessons": 5
    }
   ]
  },
  {
   "slug": "programming-with-python",
   "title": "Programming with Python",
   "discipline": "technology",
   "subject": "programming",
   "level": "Foundations",
   "weeks": 8,
   "hours": 4,
   "summary": "Write programs that solve real problems, and learn the habits that make code easy to fix and extend.",
   "modules": [
    {
     "name": "First programs",
     "lessons": 5
    },
    {
     "name": "Making decisions",
     "lessons": 5
    },
    {
     "name": "Repeating with loops",
     "lessons": 5
    },
    {
     "name": "Functions and data",
     "lessons": 6
    },
    {
     "name": "Your first project",
     "lessons": 4
    }
   ]
  },
  {
   "slug": "machine-learning-explained",
   "title": "Machine Learning, Explained",
   "discipline": "technology",
   "subject": "data-ai",
   "level": "Intermediate",
   "weeks": 6,
   "hours": 4,
   "summary": "How machines learn from examples, where they go wrong, and how to judge a model before you trust it.",
   "modules": [
    {
     "name": "Learning from data",
     "lessons": 4
    },
    {
     "name": "Lines, curves and loss",
     "lessons": 5
    },
    {
     "name": "Classifiers",
     "lessons": 5
    },
    {
     "name": "Neural networks",
     "lessons": 5
    },
    {
     "name": "Bias, fairness and limits",
     "lessons": 4
    }
   ]
  },
  {
   "slug": "forces-in-structures",
   "title": "Forces in Structures",
   "discipline": "engineering",
   "subject": "structures-materials",
   "level": "Foundations",
   "weeks": 6,
   "hours": 3,
   "summary": "Learn to see the forces inside bridges, towers and everyday objects, and design structures that carry them.",
   "modules": [
    {
     "name": "Loads and supports",
     "lessons": 4
    },
    {
     "name": "Tension and compression",
     "lessons": 5
    },
    {
     "name": "Trusses",
     "lessons": 5
    },
    {
     "name": "Beams and bending",
     "lessons": 5
    },
    {
     "name": "Design challenge: a bridge",
     "lessons": 3
    }
   ]
  },
  {
   "slug": "stress-strain-failure",
   "title": "Stress, Strain and Failure",
   "discipline": "engineering",
   "subject": "structures-materials",
   "level": "Intermediate",
   "weeks": 6,
   "hours": 4,
   "summary": "Why parts break and how engineers predict it, including how photoelastic models make stress visible.",
   "modules": [
    {
     "name": "Stress and strain",
     "lessons": 5
    },
    {
     "name": "Material properties",
     "lessons": 4
    },
    {
     "name": "Stress concentrations",
     "lessons": 5
    },
    {
     "name": "Fatigue and fracture",
     "lessons": 5
    },
    {
     "name": "Factors of safety",
     "lessons": 3
    }
   ]
  },
  {
   "slug": "circuits-and-sensors",
   "title": "Circuits and Sensors",
   "discipline": "engineering",
   "subject": "electronics",
   "level": "Foundations",
   "weeks": 6,
   "hours": 3,
   "summary": "Build circuits that sense the world and respond to it, from a single LED to a microcontroller.",
   "modules": [
    {
     "name": "Charge, current and voltage",
     "lessons": 4
    },
    {
     "name": "Resistors and Ohm’s law",
     "lessons": 5
    },
    {
     "name": "Series and parallel",
     "lessons": 4
    },
    {
     "name": "Sensors and signals",
     "lessons": 5
    },
    {
     "name": "Microcontroller basics",
     "lessons": 5
    }
   ]
  },
  {
   "slug": "algebra-from-the-ground-up",
   "title": "Algebra from the Ground Up",
   "discipline": "mathematics",
   "subject": "number-algebra",
   "level": "Foundations",
   "weeks": 8,
   "hours": 3,
   "summary": "Real fluency with expressions, equations and graphs, and an understanding of why the rules work.",
   "modules": [
    {
     "name": "Expressions",
     "lessons": 5
    },
    {
     "name": "Linear equations",
     "lessons": 5
    },
    {
     "name": "Graphs and gradients",
     "lessons": 5
    },
    {
     "name": "Quadratics",
     "lessons": 6
    },
    {
     "name": "Simultaneous equations",
     "lessons": 4
    }
   ]
  },
  {
   "slug": "calculus-mathematics-of-change",
   "title": "Calculus: the Mathematics of Change",
   "discipline": "mathematics",
   "subject": "calculus",
   "level": "Intermediate",
   "weeks": 10,
   "hours": 4,
   "summary": "Limits, derivatives and integrals, built up visually and put to work on motion, growth and optimisation.",
   "modules": [
    {
     "name": "Rates of change",
     "lessons": 5
    },
    {
     "name": "The derivative",
     "lessons": 6
    },
    {
     "name": "Rules of differentiation",
     "lessons": 6
    },
    {
     "name": "Integration",
     "lessons": 6
    },
    {
     "name": "Differential equations",
     "lessons": 5
    }
   ]
  },
  {
   "slug": "chaos-and-dynamical-systems",
   "title": "Chaos and Dynamical Systems",
   "discipline": "mathematics",
   "subject": "calculus",
   "level": "Advanced",
   "weeks": 6,
   "hours": 4,
   "summary": "How simple rules produce unpredictable behaviour, from population models to strange attractors.",
   "modules": [
    {
     "name": "Iteration and fixed points",
     "lessons": 4
    },
    {
     "name": "The logistic map",
     "lessons": 5
    },
    {
     "name": "Phase space",
     "lessons": 5
    },
    {
     "name": "Strange attractors",
     "lessons": 5
    },
    {
     "name": "Fractals and dimension",
     "lessons": 4
    }
   ]
  }
 ]
};
