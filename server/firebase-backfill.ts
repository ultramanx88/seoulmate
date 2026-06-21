import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DocumentReference, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { closeDatabase, database } from './database.js';
import { runMigrations } from './migrate.js';

const migrationConfigSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIRESTORE_DATABASE_ID: z.string().default('(default)'),
  MIGRATION_DRY_RUN: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  MIGRATION_PAGE_SIZE: z.coerce.number().int().min(1).max(1000).default(200),
});

const migrationConfig = migrationConfigSchema.parse(process.env);
const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    projectId: migrationConfig.FIREBASE_PROJECT_ID,
  });
const firestore = getFirestore(firebaseApp, migrationConfig.FIRESTORE_DATABASE_ID);
const firebaseAuth = getAuth(firebaseApp);

type MigrationStats = {
  authUsers: number;
  profiles: number;
  topics: number;
  comments: number;
  chats: number;
  messages: number;
  feeds: number;
};

const stats: MigrationStats = {
  authUsers: 0,
  profiles: 0,
  topics: 0,
  comments: 0,
  chats: 0,
  messages: 0,
  feeds: 0,
};

function normalize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof DocumentReference) return value.path;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        normalize(item),
      ]),
    );
  }
  return value;
}

function sourceHash(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(normalize(data))).digest('hex');
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

async function recordMigration(
  collectionName: string,
  firebaseDocumentId: string,
  postgresTable: string,
  postgresId: string,
  data: unknown,
  sourceUpdatedAt?: Date | null,
): Promise<void> {
  await database.query(
    `
      INSERT INTO firebase_migration_records (
        collection_name,
        firebase_document_id,
        postgres_table,
        postgres_id,
        source_updated_at,
        source_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (collection_name, firebase_document_id)
      DO UPDATE SET
        postgres_table = EXCLUDED.postgres_table,
        postgres_id = EXCLUDED.postgres_id,
        source_updated_at = EXCLUDED.source_updated_at,
        source_hash = EXCLUDED.source_hash,
        migrated_at = now()
    `,
    [
      collectionName,
      firebaseDocumentId,
      postgresTable,
      postgresId,
      sourceUpdatedAt ?? null,
      sourceHash(data),
    ],
  );
}

async function importAuthUsers(): Promise<void> {
  let pageToken: string | undefined;

  do {
    const page = await firebaseAuth.listUsers(migrationConfig.MIGRATION_PAGE_SIZE, pageToken);
    for (const user of page.users) {
      stats.authUsers += 1;
      if (migrationConfig.MIGRATION_DRY_RUN) continue;

      await database.query(
        `
          INSERT INTO users (
            id,
            firebase_uid,
            auth_provider,
            provider_subject,
            email,
            email_verified,
            display_name,
            photo_url,
            created_at,
            updated_at
          )
          VALUES ($1, $1, 'firebase', $1, $2, $3, $4, $5, $6, now())
          ON CONFLICT (id)
          DO UPDATE SET
            firebase_uid = EXCLUDED.firebase_uid,
            email = COALESCE(EXCLUDED.email, users.email),
            email_verified = EXCLUDED.email_verified,
            display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
            photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
            updated_at = now()
        `,
        [
          user.uid,
          user.email ?? null,
          user.emailVerified,
          user.displayName || user.email || `Firebase user ${user.uid}`,
          user.photoURL ?? null,
          user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
        ],
      );
      await recordMigration('firebase_auth', user.uid, 'users', user.uid, user.toJSON());
    }
    pageToken = page.pageToken;
  } while (pageToken);
}

async function importProfiles(): Promise<void> {
  const snapshot = await firestore.collection('users').get();
  for (const document of snapshot.docs) {
    const data = document.data();
    stats.profiles += 1;
    if (migrationConfig.MIGRATION_DRY_RUN) continue;

    await database.query(
      `
        INSERT INTO users (
          id,
          firebase_uid,
          auth_provider,
          provider_subject,
          display_name,
          photo_url,
          nationality,
          intent,
          interests,
          languages,
          bio,
          location,
          is_profile_complete,
          last_active_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $1, 'firebase', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          COALESCE($12, now()), now()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url,
          nationality = EXCLUDED.nationality,
          intent = EXCLUDED.intent,
          interests = EXCLUDED.interests,
          languages = EXCLUDED.languages,
          bio = EXCLUDED.bio,
          location = EXCLUDED.location,
          is_profile_complete = EXCLUDED.is_profile_complete,
          last_active_at = EXCLUDED.last_active_at,
          updated_at = now()
      `,
      [
        document.id,
        data.displayName || `Firebase user ${document.id}`,
        data.photoURL ?? null,
        data.nationality ?? null,
        data.intent ?? null,
        data.interests ?? [],
        data.languages ?? [],
        data.bio ?? null,
        data.location ? JSON.stringify(normalize(data.location)) : null,
        data.isProfileComplete ?? false,
        toDate(data.lastActiveAt),
        toDate(data.createdAt),
      ],
    );
    await recordMigration(
      'users',
      document.id,
      'users',
      document.id,
      data,
      toDate(data.updatedAt) ?? toDate(data.lastActiveAt),
    );
  }
}

async function importTopicsAndComments(): Promise<void> {
  const snapshot = await firestore.collection('topics').get();
  for (const document of snapshot.docs) {
    const data = document.data();
    stats.topics += 1;

    if (!migrationConfig.MIGRATION_DRY_RUN) {
      await database.query(
        `
          INSERT INTO topics (
            id, author_id, title, content, intent, tags, location,
            likes_count, comments_count, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, now()), now())
          ON CONFLICT (id)
          DO UPDATE SET
            author_id = EXCLUDED.author_id,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            intent = EXCLUDED.intent,
            tags = EXCLUDED.tags,
            location = EXCLUDED.location,
            likes_count = EXCLUDED.likes_count,
            comments_count = EXCLUDED.comments_count,
            updated_at = now()
        `,
        [
          document.id,
          data.authorId,
          data.title ?? '',
          data.content ?? '',
          data.intent ?? null,
          data.tags ?? [],
          data.location ? JSON.stringify(normalize(data.location)) : null,
          data.likesCount ?? 0,
          data.commentsCount ?? 0,
          toDate(data.createdAt),
        ],
      );
      await recordMigration(
        'topics',
        document.id,
        'topics',
        document.id,
        data,
        toDate(data.updatedAt) ?? toDate(data.createdAt),
      );
    }

    const comments = await document.ref.collection('comments').get();
    for (const comment of comments.docs) {
      const commentData = comment.data();
      stats.comments += 1;
      if (migrationConfig.MIGRATION_DRY_RUN) continue;

      await database.query(
        `
          INSERT INTO comments (id, topic_id, author_id, text, created_at, updated_at)
          VALUES ($1, $2, $3, $4, COALESCE($5, now()), now())
          ON CONFLICT (id)
          DO UPDATE SET
            topic_id = EXCLUDED.topic_id,
            author_id = EXCLUDED.author_id,
            text = EXCLUDED.text,
            updated_at = now()
        `,
        [
          comment.id,
          document.id,
          commentData.authorId,
          commentData.text ?? '',
          toDate(commentData.createdAt),
        ],
      );
      await recordMigration(
        'topic_comments',
        `${document.id}/${comment.id}`,
        'comments',
        comment.id,
        commentData,
        toDate(commentData.updatedAt) ?? toDate(commentData.createdAt),
      );
    }
  }
}

async function importChatsAndMessages(): Promise<void> {
  const snapshot = await firestore.collection('chats').get();
  for (const document of snapshot.docs) {
    const data = document.data();
    const participants = [...(data.participants ?? [])].sort() as string[];
    stats.chats += 1;

    if (!migrationConfig.MIGRATION_DRY_RUN) {
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
            INSERT INTO chats (
              id, participant_key, last_message, last_message_at, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, COALESCE($5, now()), now())
            ON CONFLICT (id)
            DO UPDATE SET
              participant_key = EXCLUDED.participant_key,
              last_message = EXCLUDED.last_message,
              last_message_at = EXCLUDED.last_message_at,
              updated_at = now()
          `,
          [
            document.id,
            participants.join(':'),
            data.lastMessage ?? null,
            toDate(data.lastMessageAt),
            toDate(data.createdAt),
          ],
        );
        for (const userId of participants) {
          await client.query(
            `
              INSERT INTO chat_participants (chat_id, user_id)
              VALUES ($1, $2)
              ON CONFLICT (chat_id, user_id) DO NOTHING
            `,
            [document.id, userId],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      await recordMigration(
        'chats',
        document.id,
        'chats',
        document.id,
        data,
        toDate(data.updatedAt) ?? toDate(data.lastMessageAt),
      );
    }

    const messages = await document.ref.collection('messages').get();
    for (const message of messages.docs) {
      const messageData = message.data();
      stats.messages += 1;
      if (migrationConfig.MIGRATION_DRY_RUN) continue;

      await database.query(
        `
          INSERT INTO messages (
            id, chat_id, sender_id, text, translations, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), now())
          ON CONFLICT (id)
          DO UPDATE SET
            chat_id = EXCLUDED.chat_id,
            sender_id = EXCLUDED.sender_id,
            text = EXCLUDED.text,
            translations = EXCLUDED.translations,
            updated_at = now()
        `,
        [
          message.id,
          document.id,
          messageData.senderId,
          messageData.text ?? '',
          JSON.stringify(normalize(messageData.translation ?? messageData.translations ?? {})),
          toDate(messageData.createdAt),
        ],
      );
      await recordMigration(
        'chat_messages',
        `${document.id}/${message.id}`,
        'messages',
        message.id,
        messageData,
        toDate(messageData.updatedAt) ?? toDate(messageData.createdAt),
      );
    }
  }
}

async function importPrecomputedFeeds(): Promise<void> {
  const snapshot = await firestore.collection('precomputed_feeds').get();
  for (const document of snapshot.docs) {
    const data = document.data();
    stats.feeds += 1;
    if (migrationConfig.MIGRATION_DRY_RUN) continue;

    await database.query(
      `
        INSERT INTO precomputed_feeds (user_id, topics, updated_at)
        VALUES ($1, $2, COALESCE($3, now()))
        ON CONFLICT (user_id)
        DO UPDATE SET topics = EXCLUDED.topics, updated_at = EXCLUDED.updated_at
      `,
      [
        document.id,
        JSON.stringify(normalize(data.topics ?? [])),
        toDate(data.updatedAt),
      ],
    );
    await recordMigration(
      'precomputed_feeds',
      document.id,
      'precomputed_feeds',
      document.id,
      data,
      toDate(data.updatedAt),
    );
  }
}

async function main(): Promise<void> {
  console.log(
    `Starting Firebase backfill (${migrationConfig.MIGRATION_DRY_RUN ? 'dry-run' : 'write'})`,
  );
  await runMigrations();
  await importAuthUsers();
  await importProfiles();
  await importTopicsAndComments();
  await importChatsAndMessages();
  await importPrecomputedFeeds();
  console.table(stats);
}

main()
  .catch((error) => {
    console.error('Firebase backfill failed', error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
