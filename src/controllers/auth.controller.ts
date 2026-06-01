  import { Request, Response } from 'express';
  import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
    import jwt, { SignOptions } from 'jsonwebtoken';

/**
 * Temporary in-memory user store.
 * TODO: Replace with real DB integration (e.g., DynamoDB) and remove this map.
 */
type UserRecord = {
  email: string;
  userId: string;
  fName?: string;
  lName?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const users = new Map<string, UserRecord>(); // email -> record

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function generateToken(payload: Record<string, unknown>) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET, options);
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, fName, lName, userId } = req.body as { email?: string; password?: string; fName?: string; lName?: string; userId?: string };

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid "email".' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "password". Must be >= 6 characters.',
      });
    }

    // TODO: Replace in-memory check with DB query (e.g., getUserByEmail)
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({ success: false, error: 'User already exists.' });
    }

    // create salt and derive key using scrypt
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64) as Buffer;
    const passwordHash = `${salt}:${derived.toString('hex')}`;
    const generatedUserId = userId && typeof userId === 'string' ? userId : `usr_${randomBytes(6).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: UserRecord = {
      email: email.toLowerCase(),
      userId: generatedUserId,
      fName: typeof fName === 'string' ? fName : undefined,
      lName: typeof lName === 'string' ? lName : undefined,
      passwordHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // TODO: Persist the user record in your DB instead of in-memory map
    users.set(record.email, record);

    const token = generateToken({ sub: record.userId, email: record.email });

    return res.status(201).json({
      success: true,
      data: {
        email: record.email,
        userId: record.userId,
        fName: record.fName,
        lName: record.lName,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing "email" or "password".' });
    }

    // TODO: Replace in-memory lookup with DB query (e.g., getUserByEmail)
    const record = users.get(email.toLowerCase());
    if (!record) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // verify password: stored as salt:hash
    const [salt, storedHash] = record.passwordHash.split(':');
    if (!salt || !storedHash) {
      return res.status(500).json({ success: false, error: 'Invalid stored password format.' });
    }
    const derived = scryptSync(password, salt, 64) as Buffer;
    const derivedHex = derived.toString('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const derivedBuf = Buffer.from(derivedHex, 'hex');
    if (storedBuf.length !== derivedBuf.length || !timingSafeEqual(storedBuf, derivedBuf)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // update updatedAt to now
    record.updatedAt = new Date().toISOString();

    const token = generateToken({ sub: record.userId, email: record.email });

    return res.json({
      success: true,
      data: {
        email: record.email,
        userId: record.userId,
        fName: record.fName,
        lName: record.lName,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}



