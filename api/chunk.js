// Web Content Chunker API v2.0.0
// Built by Search Influence - Last Updated: January 2025
// Enhanced with auto-detection and advanced chunking options
import fetch from 'node-fetch';
import { load } from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, mode = 'auto', chunkSize, overlap, strategy } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Parse options
  const options = {
    mode,
    chunkSize: chunkSize || 'medium', // small, medium, large
    overlap: overlap !== undefined ? parseInt(overlap) : null, // null means auto
    strategy: strategy || 'auto' // auto, heading, recursive, fixed, sentence
  };

  try {
    const chunks = await chunkUrl(url, options);
    res.status(200).json({ success: true, data: chunks });
  } catch (error) {
    console.error('Chunking error:', error);
    console.error('Error stack:', error.stack);
    console.error('URL:', url);
    console.error('Options:', options);
    res.status(500).json({
      error: 'Failed to process URL',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Helper function to count words in text
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Helper function to estimate tokens (rough approximation: 1 token ≈ 0.75 words)
function estimateTokens(text) {
  return Math.ceil(countWords(text) * 0.75);
}

// Helper function to split text into sentences
function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

async function chunkUrl(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Web Content Chunker/2.0'
    },
    timeout: 30000
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const $ = load(html);

  function cleanText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isInNavOrFooter(element) {
    return $(element).closest('nav, footer, header.site-header').length > 0;
  }

  function shouldSkip(text) {
    const skipPatterns = [
      /^\s*$/,
      /^(facebook|twitter|instagram|linkedin)$/i,
      /^\d+\s*share/i,
      /^comments off/i,
      /^<img/,
      /^\s*\d+\s*$/,
      /^(facebook twitter pinterest linkedin)$/i,
      /privacy policy$/i,
      /^share$/i,
      /^tweet$/i
    ];
    return skipPatterns.some(pattern => pattern.test(text));
  }

  // Auto-detection: Analyze content to determine optimal parameters
  function autoDetectParameters($) {
    const headings = $('h1, h2, h3, h4, h5, h6').filter((_, h) => !isInNavOrFooter(h));
    const allText = $('body').text();
    const totalWords = countWords(allText);
    const headingCount = headings.length;

    // Determine chunk size based on total content length
    let chunkSize = 'medium';
    if (totalWords < 500) {
      chunkSize = 'small';
    } else if (totalWords > 2000) {
      chunkSize = 'large';
    }

    // Determine strategy based on heading density
    let strategy = 'heading';
    if (headingCount === 0) {
      strategy = 'fixed';
    } else if (headingCount > 20) {
      strategy = 'recursive'; // Lots of headings, use recursive to merge
    }

    // Auto-calculate overlap (10% of target chunk size)
    const targetSizes = { small: 150, medium: 350, large: 750 };
    const overlap = Math.round(targetSizes[chunkSize] * 0.1);

    return { chunkSize, strategy, overlap };
  }

  // Apply options with auto-detection fallback
  const detectedParams = autoDetectParameters($);
  const finalOptions = {
    chunkSize: options.chunkSize || detectedParams.chunkSize,
    strategy: options.strategy === 'auto' ? detectedParams.strategy : options.strategy,
    overlap: (options.overlap !== null && options.overlap !== undefined) ? options.overlap : detectedParams.overlap
  };

  // Get target word count based on chunk size
  const chunkSizes = {
    small: { min: 100, max: 200, target: 150 },
    medium: { min: 200, max: 500, target: 350 },
    large: { min: 500, max: 1000, target: 750 }
  };
  const targetSize = chunkSizes[finalOptions.chunkSize];

  // Helper function to recursively split chunks that are too large
  function recursiveSplit(text, maxWords) {
    const wordCount = countWords(text);
    if (wordCount <= maxWords) {
      return [text];
    }

    // Try splitting by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length > 1) {
      const result = [];
      let current = '';
      for (const para of paragraphs) {
        const testText = current ? `${current}\n\n${para}` : para;
        if (countWords(testText) <= maxWords) {
          current = testText;
        } else {
          if (current) result.push(current);
          current = para;
          // If single paragraph is too large, split by sentences
          if (countWords(current) > maxWords) {
            result.push(...splitBySentences(current, maxWords));
            current = '';
          }
        }
      }
      if (current) result.push(current);
      return result;
    }

    // Fall back to sentence splitting
    return splitBySentences(text, maxWords);
  }

  function splitBySentences(text, maxWords) {
    const sentences = splitSentences(text);
    const result = [];
    let current = '';

    for (const sentence of sentences) {
      const testText = current ? `${current} ${sentence}` : sentence;
      if (countWords(testText) <= maxWords) {
        current = testText;
      } else {
        if (current) result.push(current);
        current = sentence;
      }
    }
    if (current) result.push(current);
    return result;
  }

  // Helper function to merge small chunks
  function mergeSmallChunks(chunks, minWords = 50) {
    if (chunks.length <= 1) return chunks;

    const result = [];
    let i = 0;

    while (i < chunks.length) {
      let current = chunks[i];
      let wordCount = countWords(current);

      // If current chunk is too small, try merging with next
      while (wordCount < minWords && i + 1 < chunks.length) {
        i++;
        current = `${current}\n\n${chunks[i]}`;
        wordCount = countWords(current);
      }

      result.push(current);
      i++;
    }

    return result;
  }

  // Helper function to add overlap between chunks
  function addOverlap(chunks, overlapWords) {
    if (overlapWords === 0 || chunks.length <= 1) return chunks;

    const result = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        result.push(chunks[i]);
      } else {
        // Get last N words from previous chunk
        const prevWords = chunks[i - 1].trim().split(/\s+/);
        const overlapText = prevWords.slice(-Math.min(overlapWords, prevWords.length)).join(' ');
        result.push(`${overlapText} ${chunks[i]}`);
      }
    }
    return result;
  }

  // Extract content pieces from DOM elements
  function extractContentPieces(startElement, stopCondition) {
    const contents = [];
    let current = startElement.next();

    while (current.length) {
      if (stopCondition(current)) break;

      let text = '';
      if (current.is('p, div:not(:has(*)), section, article')) {
        text = cleanText(current.text());
      } else if (current.is('ul, ol')) {
        const listItems = [];
        current.find('li').each((_, li) => {
          const liText = cleanText($(li).text());
          if (liText && liText.length > 2 && !shouldSkip(liText)) {
            listItems.push(`- ${liText}`);
          }
        });
        if (listItems.length > 0) {
          text = listItems.join('\n');
        }
      } else if (current.is('blockquote')) {
        text = cleanText(current.text());
        if (text) text = `> ${text}`;
      } else if (current.is('pre, code')) {
        text = cleanText(current.text());
        if (text) text = `\`\`\`\n${text}\n\`\`\``;
      }

      if (text && text.length > 15 && !shouldSkip(text)) {
        contents.push(text);
      }

      current = current.next();
    }

    return contents;
  }

  // Main chunking logic based on strategy
  const bigChunks = [];
  const globalSeen = new Set();

  if (finalOptions.strategy === 'heading' || finalOptions.strategy === 'recursive') {
    // Find all headings first
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, heading) => {
      const $h = $(heading);
      if (!isInNavOrFooter(heading)) {
        const title = cleanText($h.text());
        if (title && title.length >= 3) {
          headings.push({
            element: $h,
            title: title,
            level: Number(heading.tagName.charAt(1)),
            index: i
          });
        }
      }
    });

    // Process each heading and get content until next heading
    headings.forEach((heading, idx) => {
      const contents = [];
      const seen = new Set();

      // Get content between this heading and the next heading
      const nextHeading = headings[idx + 1];
      const stopCondition = (current) => {
        if (nextHeading && current[0] === nextHeading.element[0]) return true;
        if (current.is('h1, h2, h3, h4, h5, h6') && current[0] !== heading.element[0]) return true;
        return false;
      };

      const pieces = extractContentPieces(heading.element, stopCondition);

      // Deduplicate and add to contents
      for (const piece of pieces) {
        if (!seen.has(piece) && !globalSeen.has(piece)) {
          contents.push(piece);
          seen.add(piece);
          globalSeen.add(piece);
        }
      }

      // Combine all pieces into one text block for processing
      if (contents.length > 0) {
        let combinedText = contents.join('\n\n');

        // For recursive strategy, apply size-based splitting
        let finalChunks = [];
        if (finalOptions.strategy === 'recursive') {
          finalChunks = recursiveSplit(combinedText, targetSize.max);
          finalChunks = mergeSmallChunks(finalChunks, 50);
        } else {
          // For heading strategy, keep original structure
          finalChunks = contents;
        }

        if (finalChunks.length > 0) {
          bigChunks.push({
            big_chunk_index: bigChunks.length + 1,
            title: heading.title,
            level: heading.level,
            small_chunks: finalChunks
          });
        }
      }
    });
  }

  // Fallback: If no headings found, use fixed-size chunking
  if (bigChunks.length === 0 || finalOptions.strategy === 'fixed') {
    const mainContent = $('main, article, .content, .post-content, .entry-content').first();
    if (mainContent.length) {
      const allParagraphs = [];

      mainContent.find('p, li').each((_, elem) => {
        const text = cleanText($(elem).text());
        if (text && text.length > 20 && !shouldSkip(text)) {
          allParagraphs.push(text);
        }
      });

      if (allParagraphs.length > 0) {
        const combinedText = allParagraphs.join('\n\n');
        const fixedChunks = recursiveSplit(combinedText, targetSize.max);
        const mergedChunks = mergeSmallChunks(fixedChunks, 50);

        if (mergedChunks.length > 0) {
          bigChunks.push({
            big_chunk_index: 1,
            title: 'Main Content',
            level: 1,
            small_chunks: mergedChunks
          });
        }
      }
    }
  }

  // Apply overlap if specified
  bigChunks.forEach(chunk => {
    if (finalOptions.overlap > 0) {
      chunk.small_chunks = addOverlap(chunk.small_chunks, finalOptions.overlap);
    }
  });

  // Add metadata to chunks
  const enhancedChunks = bigChunks.map(chunk => {
    const smallChunksWithMetadata = chunk.small_chunks.map((content, idx) => ({
      text: content,
      word_count: countWords(content),
      char_count: content.length,
      token_estimate: estimateTokens(content),
      chunk_index: idx + 1
    }));

    const totalWords = smallChunksWithMetadata.reduce((sum, c) => sum + c.word_count, 0);
    const totalTokens = smallChunksWithMetadata.reduce((sum, c) => sum + c.token_estimate, 0);

    return {
      ...chunk,
      small_chunks: smallChunksWithMetadata,
      metadata: {
        total_small_chunks: smallChunksWithMetadata.length,
        total_words: totalWords,
        total_characters: smallChunksWithMetadata.reduce((sum, c) => sum + c.char_count, 0),
        total_tokens_estimate: totalTokens
      }
    };
  });

  // Clean up and filter
  const cleanedChunks = enhancedChunks
    .filter(chunk => chunk.small_chunks.length > 0)
    .map((chunk, index) => ({
      ...chunk,
      big_chunk_index: index + 1
    }));

  return {
    big_chunks: cleanedChunks,
    settings: {
      strategy: finalOptions.strategy,
      chunk_size: finalOptions.chunkSize,
      overlap_words: finalOptions.overlap,
      auto_detected: options.mode === 'auto' || options.strategy === 'auto'
    },
    summary: {
      total_big_chunks: cleanedChunks.length,
      total_small_chunks: cleanedChunks.reduce((sum, c) => sum + c.small_chunks.length, 0),
      total_words: cleanedChunks.reduce((sum, c) => sum + c.metadata.total_words, 0),
      total_tokens_estimate: cleanedChunks.reduce((sum, c) => sum + c.metadata.total_tokens_estimate, 0)
    }
  };
}
