// =====================================================
// auth.controller.ts — PATCH for register endpoint
// 
// The original register function expects { email, password, name, role }
// The v2 frontend sends { email, password, firstName, lastName, name, role, phone, dob, ... }
//
// INSTRUCTIONS: Replace the 'register' function body in
// C:\UTH.AI\backend\src\controllers\auth.controller.ts
// with the version below.
// =====================================================

export const register_v2 = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email, password,
      // Support both name formats
      name: rawName,
      firstName, lastName,
      // Role
      role,
      // Patient health profile fields (ignored if no User column yet; added after migration)
      phone, dob, gender, bloodGroup, allergies, conditions,
    } = req.body;

    const fullName = rawName || [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';
    const userRole = (role || 'PATIENT').toUpperCase() as 'PATIENT' | 'DOCTOR' | 'ADMIN';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: fullName,
        role: userRole,
        // Health profile fields (only included once columns are migrated)
        ...(phone      && { phone }),
        ...(dob        && { dob }),
        ...(gender     && { gender }),
        ...(bloodGroup && { bloodGroup }),
        ...(allergies  && { allergies }),
        ...(conditions && { conditions }),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_for_placement';
    const token = require('jsonwebtoken').sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token + user so frontend can auto-login after register
    res.status(201).json({
      token,
      user: {
        id:        user.id,
        email:     user.email,
        name:      user.name,
        firstName: firstName || user.name.split(' ')[0],
        role:      user.role.toLowerCase(),
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
