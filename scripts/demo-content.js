/**
 * scripts/demo-content.js
 *
 * Demo Content Population Script.
 * Idempotently uploads two sample study documents (Physics and Chemistry, ~5 pages each)
 * to the Demo Coaching Institute batches, processes them through the real AI pipeline,
 * and marks the generated items (notes, quizzes, flashcards) as approved.
 *
 * DO NOT RUN THIS SCRIPT UNLESS EXPLICITLY REQUESTED.
 *
 * Usage:
 *   node scripts/demo-content.js
 *   npm run demo:content
 */

import '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { getStorageClient, getBucket } from '../lib/storage.js';

/** Upload a Buffer directly to Supabase Storage (server-side, no signed URL needed). */
async function uploadFile(storagePath, buffer, contentType) {
  const supabase = getStorageClient();
  const bucket = getBucket();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw error;
}
import {
  processDocument,
  generateNotes,
  generateQuiz,
  generateFlashcards,
} from '../worker/handlers.js';

const PHYSICS_CONTENT = `=== PAGE 1 ===
CHAPTER 1: KINEMATICS AND RECTILINEAR MOTION

Kinematics describes the motion of points, bodies, and systems of bodies without consideration of the forces that cause them to move.
Motion along a straight line is called one-dimensional or rectilinear motion.

Position, Displacement, and Distance:
The position of a particle refers to its location relative to a chosen reference point, called the origin.
Displacement is a vector quantity defined as the change in position: Delta x = x_final - x_initial.
Distance is the total length of the path traveled and is a scalar quantity that is always non-negative.

Velocity and Speed:
Average velocity is the displacement divided by the time interval: v_avg = Delta x / Delta t.
Instantaneous velocity is the time derivative of position: v(t) = dx/dt.
Average speed is total distance divided by elapsed time. Instantaneous speed is the magnitude of instantaneous velocity.

Acceleration:
Acceleration measures the rate at which velocity changes over time.
Average acceleration: a_avg = Delta v / Delta t.
Instantaneous acceleration: a(t) = dv/dt = d^2x/dt^2.

Kinematic Equations for Constant Acceleration:
When acceleration a is constant, the following four fundamental kinematic relations hold:
1. v = v_0 + a * t
2. x = x_0 + v_0 * t + 0.5 * a * t^2
3. v^2 = v_0^2 + 2 * a * (x - x_0)
4. x - x_0 = ((v_0 + v) / 2) * t

Free Fall Motion:
An object in free fall near Earth experiences a constant downward acceleration due to gravity, g = 9.8 m/s^2, directed toward Earth's center, neglecting air resistance.

=== PAGE 2 ===
CHAPTER 2: NEWTON'S LAWS OF MOTION

Sir Isaac Newton formulated the three classical laws of motion which form the foundation of classical mechanics.

Newton's First Law (Law of Inertia):
An object continues in its state of rest or of uniform motion in a straight line unless acted upon by a non-zero net external force.
Inertia is the natural tendency of an object to resist changes in its state of motion. Mass is the quantitative measure of inertia.

Newton's Second Law (Fundamental Law of Dynamics):
The rate of change of linear momentum of a body is directly proportional to the applied net force and takes place in the direction of the force.
Mathematically, F_net = dp/dt.
For a body with constant mass m, this simplifies to the famous formula: F_net = m * a.
The SI unit of force is the Newton (N), where 1 N = 1 kg * m/s^2.

Newton's Third Law (Action and Reaction):
Whenever one object exerts a force on a second object, the second object exerts an equal and opposite force on the first object.
Forces always occur in matched interaction pairs. Action and reaction forces act on different bodies, never canceling each other out on a single object.

Common Types of Forces:
1. Gravitational Force (Weight): W = m * g, acting downward toward the center of mass of the planet.
2. Normal Force (N): The perpendicular contact force exerted by a surface supporting an object.
3. Frictional Force: Opposes relative motion between surfaces in contact. Static friction: f_s <= mu_s * N. Kinetic friction: f_k = mu_k * N.
4. Tension Force (T): Force transmitted through a string, rope, or cable pulled taut by forces acting at each end.

=== PAGE 3 ===
CHAPTER 3: WORK, ENERGY, AND POWER

Work done by a constant force F acting on a particle undergoing displacement d is defined as the dot product:
W = F . d = F * d * cos(theta), where theta is the angle between the force and displacement vectors.
The SI unit of work and energy is the Joule (J), where 1 J = 1 N * m = 1 kg * m^2/s^2.

Kinetic Energy:
Kinetic energy (K) is the energy associated with an object's motion:
K = 0.5 * m * v^2.

The Work-Energy Theorem:
The net work done on a particle equals the change in its kinetic energy:
W_net = Delta K = K_final - K_initial.

Potential Energy:
Potential energy (U) is stored energy resulting from an object's position or configuration within a conservative force field.
1. Gravitational Potential Energy: Near Earth's surface, U_g = m * g * h, where h is the vertical elevation above an arbitrary reference plane.
2. Elastic Potential Energy: For an ideal spring obeying Hooke's Law (F = -k * x), U_s = 0.5 * k * x^2, where k is the spring constant and x is extension.

Conservation of Mechanical Energy:
In an isolated system where only conservative forces do work, the total mechanical energy E = K + U remains constant:
E_initial = E_final => K_1 + U_1 = K_2 + U_2.

Power:
Power is the rate at which work is performed or energy is transferred:
Average power: P_avg = W / Delta t.
Instantaneous power: P = dW/dt = F . v.
The SI unit of power is the Watt (W), where 1 W = 1 J/s.

=== PAGE 4 ===
CHAPTER 4: LINEAR MOMENTUM AND COLLISIONS

Linear momentum p of a particle of mass m moving with velocity v is defined as the product:
p = m * v.
Momentum is a vector quantity possessing the same direction as velocity. The SI unit of momentum is kg * m/s.

Impulse and Impulse-Momentum Theorem:
Impulse J is defined as the integral of force over the time interval of collision:
J = Integral(F dt) = F_avg * Delta t.
The impulse-momentum theorem states that impulse delivered to a particle equals its change in linear momentum:
J = Delta p = p_final - p_initial.

Conservation of Linear Momentum:
If the net external force acting on an isolated system is zero, the total linear momentum of the system is strictly conserved:
p_total,initial = p_total,final.

Classification of Collisions:
1. Elastic Collision: Both total linear momentum and total kinetic energy are conserved. Relative speed of separation equals relative speed of approach.
2. Inelastic Collision: Total linear momentum is conserved, but kinetic energy is not conserved (some kinetic energy transforms into thermal energy or sound).
3. Completely Inelastic Collision: The colliding bodies stick together after impact and move with a common final velocity. The loss of kinetic energy is maximal.

Center of Mass:
The center of mass of a system of particles is the weighted average position:
r_cm = (Sum of m_i * r_i) / (Sum of m_i).
The total momentum equals system mass multiplied by velocity of center of mass: P_total = M * v_cm.

=== PAGE 5 ===
CHAPTER 5: CIRCULAR MOTION AND GRAVITATION

Uniform Circular Motion:
When a particle moves in a circular path of radius r at constant speed v, its direction of motion continuously changes, producing an inward acceleration.
Centripetal Acceleration:
a_c = v^2 / r = omega^2 * r, directed radially toward the center of the circle, where omega is the angular velocity (omega = v / r).

Centripetal Force:
According to Newton's Second Law, the net force causing centripetal acceleration is:
F_c = m * a_c = (m * v^2) / r.
Centripetal force is not an independent physical force; it is the net radial component of real forces such as tension, friction, or gravity.

Newton's Law of Universal Gravitation:
Every point mass attracts every other point mass with a force along the line intersecting both points:
F_g = G * (m_1 * m_2) / r^2,
where G is Newton's gravitational constant (G = 6.674 * 10^-11 N * m^2 / kg^2) and r is the distance between centers of mass.

Gravitational Field and Orbital Speed:
The gravitational field strength g at distance r from a spherical body of mass M is:
g = G * M / r^2.
For a satellite in stable circular orbit of radius r around a planet of mass M:
v_orbit = sqrt(G * M / r).
The orbital period T is given by Kepler's Third Law:
T^2 = (4 * pi^2 * r^3) / (G * M).
`;

const CHEMISTRY_CONTENT = `=== PAGE 1 ===
CHAPTER 1: ATOMIC STRUCTURE AND QUANTUM PRINCIPLES

All matter is composed of basic structural units called atoms. An atom consists of a tiny, dense, positively charged nucleus surrounded by electrons.

Subatomic Particles:
1. Proton: Positive charge (+1.602 * 10^-19 C), mass 1.673 * 10^-27 kg (~1.007 u), located in the nucleus.
2. Neutron: Neutral (zero charge), mass 1.675 * 10^-27 kg (~1.008 u), located in the nucleus.
3. Electron: Negative charge (-1.602 * 10^-19 C), mass 9.109 * 10^-31 kg (~0.00055 u), occupies regions outside the nucleus.

Atomic Number and Mass Number:
Atomic number (Z) is the number of protons in an atom's nucleus, defining its elemental identity.
Mass number (A) is the total number of nucleons (protons + neutrons): A = Z + N.
Isotopes are atoms of the same element having identical atomic numbers but different mass numbers due to differing neutron counts.

Bohr Model of the Hydrogen Atom:
Niels Bohr proposed that electrons orbit the nucleus only in discrete, quantized energy levels:
1. Angular momentum is quantized: L = n * (h / (2 * pi)), where n = 1, 2, 3...
2. Energy of hydrogen electron in level n: E_n = -13.6 eV / n^2.
3. Emission of radiation occurs when an electron transitions from higher orbit n_2 to lower orbit n_1:
Delta E = E_2 - E_1 = h * nu = h * c / lambda.

Quantum Mechanical Model:
Electrons exhibit wave-particle duality (de Broglie hypothesis: lambda = h / p).
Heisenberg Uncertainty Principle states it is impossible to determine simultaneously both the exact position and momentum of an electron:
Delta x * Delta p >= h / (4 * pi).

=== PAGE 2 ===
CHAPTER 2: QUANTUM NUMBERS AND ELECTRON CONFIGURATIONS

Electrons in an atom are described by four quantum numbers that define their spatial distribution and spin state:

1. Principal Quantum Number (n):
Indicates the main energy level or shell. Takes positive integer values: n = 1, 2, 3, 4... Maximum electrons per shell = 2 * n^2.

2. Azimuthal (Orbital Angular Momentum) Quantum Number (l):
Defines the three-dimensional shape of the orbital (subshell).
Takes values from 0 to n - 1:
- l = 0: s orbital (spherical)
- l = 1: p orbital (dumbbell-shaped, three degenerate orientations)
- l = 2: d orbital (cloverleaf-shaped, five orientations)
- l = 3: f orbital (seven orientations)

3. Magnetic Quantum Number (m_l):
Specifies the spatial orientation of the orbital along standard axes.
Takes integer values from -l to +l (total of 2l + 1 orientations per subshell).

4. Spin Quantum Number (m_s):
Describes the intrinsic spin angular momentum of the electron.
Takes values of +1/2 (spin up) or -1/2 (spin down).

Rules for Assigning Electron Configurations:
1. Aufbau Principle: Electrons fill atomic orbitals of lowest available energy first before occupying higher levels (1s < 2s < 2p < 3s < 3p < 4s < 3d...).
2. Pauli Exclusion Principle: No two electrons in an atom can have the identical set of all four quantum numbers. Therefore, an orbital can hold at most two electrons of opposite spin.
3. Hund's Rule of Maximum Multiplicity: When degenerate orbitals of equal energy are available, electrons occupy them singly with parallel spins before pairing begins.

=== PAGE 3 ===
CHAPTER 3: PERIODIC CLASSIFICATION AND PERIODIC TRENDS

The Modern Periodic Table arranges elements in order of increasing atomic number according to Moseley's Periodic Law.
Elements are organized into 7 horizontal rows called periods and 18 vertical columns called groups.

Key Periodic Trends:
1. Effective Nuclear Charge (Z_eff):
The net positive charge experienced by valence electrons after accounting for shielding by core electrons: Z_eff = Z - S.
Increases across a period from left to right; remains relatively constant down a group.

2. Atomic Radius:
Decreases across a period from left to right because increasing Z_eff pulls electrons closer to the nucleus.
Increases down a group due to the addition of successive principal energy shells.

3. Ionization Energy (IE):
The minimum energy required to remove the most loosely bound electron from an isolated gaseous atom:
X(g) + IE -> X+(g) + e-.
Generally increases across a period due to higher Z_eff and decreasing atomic size.
Decreases down a group due to increased shielding and distance from the nucleus.

4. Electron Affinity (EA):
The energy change when an electron is added to a gaseous neutral atom to form an anion:
X(g) + e- -> X-(g).
Becomes more exothermic (more negative) across a period; decreases in magnitude down a group. Halogens possess the highest electron affinities.

5. Electronegativity:
The relative ability of an atom in a chemical bond to attract shared electron pairs toward itself (measured on the Pauling scale).
Fluorine is the most electronegative element (value 4.0). Electronegativity increases across a period and decreases down a group.

=== PAGE 4 ===
CHAPTER 4: CHEMICAL BONDING AND MOLECULAR GEOMETRY

Atoms form chemical bonds to achieve a stable, low-energy electron configuration, typically resembling the nearest noble gas (octet rule).

Types of Chemical Bonds:
1. Ionic Bonding:
Formed by the complete electrostatic transfer of one or more valence electrons from a metal (low ionization energy) to a non-metal (high electron affinity).
Produces positive cations and negative anions arranged in a rigid crystal lattice.
Lattice Energy is the energy released when gaseous ions form one mole of solid ionic compound: U proportional to (q_1 * q_2) / r_0.

2. Covalent Bonding:
Formed by the mutual sharing of one or more pairs of valence electrons between non-metal atoms.
- Non-polar covalent: Equal sharing of electron pair (electronegativity difference < 0.4).
- Polar covalent: Unequal sharing resulting in a dipole moment (electronegativity difference between 0.4 and 1.8).

VSEPR Theory (Valence Shell Electron Pair Repulsion):
Postulates that electron pairs around a central atom arrange themselves to minimize mutual electrostatic repulsion.
Geometry predictions based on steric number (bonding pairs + lone pairs):
- Steric number 2: Linear (bond angle 180 deg, e.g., BeCl2, CO2)
- Steric number 3: Trigonal planar (bond angle 120 deg, e.g., BF3); bent with 1 lone pair (e.g., SO2)
- Steric number 4: Tetrahedral (bond angle 109.5 deg, e.g., CH4); trigonal pyramidal with 1 lone pair (bond angle 107 deg, e.g., NH3); bent with 2 lone pairs (bond angle 104.5 deg, e.g., H2O)
- Steric number 5: Trigonal bipyramidal (bond angles 90 deg and 120 deg, e.g., PCl5)
- Steric number 6: Octahedral (bond angle 90 deg, e.g., SF6)

=== PAGE 5 ===
CHAPTER 5: STOICHIOMETRY AND THE MOLE CONCEPT

Stoichiometry deals with quantitative relationships among reactants and products in balanced chemical equations.

The Mole Concept:
A mole is the amount of substance containing exactly 6.02214 * 10^23 elementary entities (Avogadro's number, N_A).
Molar mass (M) is the mass in grams of one mole of a substance (g/mol), numerically equal to the formula weight in atomic mass units.

Fundamental Stoichiometric Formulas:
1. Number of moles: n = mass (m) / molar mass (M).
2. Number of particles: N = n * N_A.
3. Molar volume of ideal gas at STP (0 deg C, 1 atm): V_m = 22.4 L/mol.
4. Ideal Gas Equation: P * V = n * R * T, where R = 0.0821 L*atm/(mol*K) = 8.314 J/(mol*K).

Solution Concentration:
Molarity (M) = moles of solute / liters of solution (mol/L).
Molality (m) = moles of solute / kilograms of solvent (mol/kg).
Mole fraction (X_A) = moles of component A / total moles of all components.

Limiting Reactant and Reaction Yield:
The limiting reactant is the reactant that is completely consumed first in a reaction, determining the maximum theoretical yield of product.
Excess reactants remain unreacted after the limiting reactant is exhausted.
Percentage Yield:
Percent Yield = (Actual Yield / Theoretical Yield) * 100%.
`;

async function main() {
  console.log('🚀 Checking demo content prerequisites…');

  // 1. Find Demo Coaching Institute
  const instRes = await query("SELECT id FROM institutes WHERE name = 'Demo Coaching Institute'");
  if (instRes.rows.length === 0) {
    console.error('❌ Demo Coaching Institute not found. Please run npm run db:seed first.');
    process.exit(1);
  }
  const instituteId = instRes.rows[0].id;

  // 2. Find batches
  const physBatchRes = await query(
    "SELECT id FROM batches WHERE institute_id = $1 AND name = 'Physics Batch A'",
    [instituteId]
  );
  const chemBatchRes = await query(
    "SELECT id FROM batches WHERE institute_id = $1 AND name = 'Chemistry Batch B'",
    [instituteId]
  );

  if (physBatchRes.rows.length === 0 || chemBatchRes.rows.length === 0) {
    console.error('❌ Demo batches not found. Please run npm run db:seed first.');
    process.exit(1);
  }
  const physBatchId = physBatchRes.rows[0].id;
  const chemBatchId = chemBatchRes.rows[0].id;

  // 3. Find demo teacher
  const teacherRes = await query(
    "SELECT id FROM users WHERE institute_id = $1 AND email = 'teacher@demo.test'",
    [instituteId]
  );
  if (teacherRes.rows.length === 0) {
    console.error('❌ Demo teacher not found. Please run npm run db:seed first.');
    process.exit(1);
  }
  const teacherId = teacherRes.rows[0].id;

  // Helper to process document and generate approved items
  async function setupDemoDoc(batchId, title, fileName, textContent) {
    // Check if document already exists and is ready
    const existingDoc = await query(
      'SELECT id, status FROM documents WHERE institute_id = $1 AND batch_id = $2 AND title = $3',
      [instituteId, batchId, title]
    );

    let docId;
    if (existingDoc.rows.length > 0) {
      docId = existingDoc.rows[0].id;
      console.log(`ℹ️  Document "${title}" already exists (${docId}, status: ${existingDoc.rows[0].status}).`);
    } else {
      console.log(`📄 Creating and uploading document "${title}"…`);
      const buffer = Buffer.from(textContent, 'utf-8');
      const storagePath = `${instituteId}/${batchId}/demo-${Date.now()}/${fileName}`;

      await uploadFile(storagePath, buffer, 'text/plain');

      const docInsert = await query(
        `INSERT INTO documents (institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status)
         VALUES ($1, $2, $3, 'batch', $4, $5, 'txt', $6, 'processing')
         RETURNING id`,
        [instituteId, batchId, teacherId, title, fileName, storagePath]
      );
      docId = docInsert.rows[0].id;

      console.log(`⚙️  Processing document "${title}" through pipeline…`);
      await processDocument({ document_id: docId });
    }

    // Generate items if not present
    const existingItems = await query(
      'SELECT item_type, status FROM generated_items WHERE document_id = $1',
      [docId]
    );
    const existingTypes = new Set(existingItems.rows.map((r) => r.item_type));

    if (!existingTypes.has('notes')) {
      console.log(`📝 Generating notes for "${title}"…`);
      await generateNotes({ document_id: docId });
    }
    if (!existingTypes.has('quiz')) {
      console.log(`🎯 Generating quiz for "${title}"…`);
      await generateQuiz({ document_id: docId });
    }
    if (!existingTypes.has('flashcards')) {
      console.log(`🗂️  Generating flashcards for "${title}"…`);
      await generateFlashcards({ document_id: docId });
    }

    // Approve all items for this document
    console.log(`✅ Approving generated items for "${title}"…`);
    await query(
      `UPDATE generated_items
       SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
       WHERE document_id = $1 AND status != 'approved'`,
      [docId, teacherId]
    );
  }

  // Populate Physics & Chemistry docs
  await setupDemoDoc(
    physBatchId,
    'Physics Mechanics & Gravitation',
    'physics_mechanics.txt',
    PHYSICS_CONTENT
  );

  await setupDemoDoc(
    chemBatchId,
    'Chemistry Structure & Bonding',
    'chemistry_bonding.txt',
    CHEMISTRY_CONTENT
  );

  console.log('🎉 Demo content population completed successfully!');
  await closePool();
}

main().catch(async (err) => {
  console.error('Fatal error during demo content generation:', err);
  await closePool();
  process.exit(1);
});
