ALTER TABLE sht.article
    ADD COLUMN IF NOT EXISTS id BIGINT;

DO $$
BEGIN
    IF to_regclass('sht.article_id_seq') IS NULL THEN
        CREATE SEQUENCE sht.article_id_seq;
        ALTER SEQUENCE sht.article_id_seq OWNED BY sht.article.id;
    END IF;
END $$;

ALTER TABLE sht.article
    ALTER COLUMN id SET DEFAULT nextval('sht.article_id_seq');

UPDATE sht.article
SET id = nextval('sht.article_id_seq')
WHERE id IS NULL;

SELECT setval(
    'sht.article_id_seq',
    COALESCE((SELECT MAX(id) FROM sht.article), 1),
    true
);

ALTER TABLE sht.article
    ADD COLUMN IF NOT EXISTS category VARCHAR(255);

UPDATE sht.article
SET category = sub_type
WHERE category IS NULL AND sub_type IS NOT NULL;

ALTER TABLE sht.article
    ADD COLUMN IF NOT EXISTS website VARCHAR(64);

UPDATE sht.article
SET website = 'sehuatang'
WHERE website IS NULL OR website = '';

ALTER TABLE sht.article
    ALTER COLUMN website SET DEFAULT 'sehuatang',
    ALTER COLUMN website SET NOT NULL,
    ALTER COLUMN id SET NOT NULL;

ALTER TABLE sht.article
    ADD COLUMN IF NOT EXISTS edk TEXT;

ALTER TABLE sht.article
    DROP CONSTRAINT IF EXISTS article_pkey;

ALTER TABLE sht.article
    ADD CONSTRAINT article_pkey PRIMARY KEY (id);

ALTER TABLE sht.article
    DROP CONSTRAINT IF EXISTS article_tid_key;

DROP INDEX IF EXISTS sht.uq_article_website_tid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_article_website_tid
    ON sht.article (website, tid);

CREATE INDEX IF NOT EXISTS idx_article_section
    ON sht.article (section);

CREATE INDEX IF NOT EXISTS idx_article_category
    ON sht.article (category);

ALTER TABLE sht.article
    DROP COLUMN IF EXISTS sub_type;
