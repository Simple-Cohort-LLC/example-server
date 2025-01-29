const express = require("express");
const {
  NeynarAPIClient,
  AuthorizationUrlResponseType,
  CastParamType,
} = require("@neynar/nodejs-sdk");
var { json } = require("body-parser");
const { PrismaClient } = require("@prisma/client");

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey || apiKey !== process.env.CLIENT_API_KEY) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  next();
};

const app = express();

app.use(json());
app.use(authenticateApiKey);

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_CLIENT_ID = process.env.NEYNAR_CLIENT_ID;
const PINATA_BEARER_TOKEN = process.env.PINATA_BEARER_TOKEN;

const client = new NeynarAPIClient(NEYNAR_API_KEY);

app.get("/get-auth-url", async (_, res) => {
  try {
    const { authorization_url } = await client.fetchAuthorizationUrl(
      NEYNAR_CLIENT_ID,
      AuthorizationUrlResponseType.Code
    );
    res.json({ authorization_url });
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/user", async (req, res) => {
  const { fid } = req.query;

  try {
    const { users } = await client.fetchBulkUsers([fid]);
    const user = users[0];
    const { display_name, pfp_url } = user;
    res.json({ display_name, pfp_url });
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/user/channel/member", async (req, res) => {
  const { fid, channel } = req.query;

  const fetch = (await import("node-fetch")).default;

  try {
    const url = `https://api.neynar.com/v2/farcaster/channel/member/list?channel_id=${channel}&fid=${fid}&limit=20`;
    const options = {
      method: "GET",
      headers: { accept: "application/json", api_key: NEYNAR_API_KEY },
    };

    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        res.status(200).json(json);
      })
      .catch((err) => console.error("error:" + err));
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/user/channel/memberships", async (req, res) => {
  const { fid } = req.query;

  try {
    const { members } = await client.fetchUserChannelMemberships(fid, {
      limit: 100,
    });

    const data = members.map((member) => {
      return {
        channel_id: member.channel.id,
        image: member.channel.image_url,
      };
    });

    res.json({ data });
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/user/casts", async (req, res) => {
  const { fid } = req.query;

  try {
    const { casts } = await client.fetchCastsForUser(fid, {
      viewerFid: fid,
      limit: 50,
      includeReplies: false,
    });
    res.json({ casts });
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.post("/cast", async (req, res) => {
  const { signerUuid, text, channel, embeds } = req.body;

  try {
    const options = {};

    if (channel) {
      options.channel_id = channel;
    }

    if (embeds && embeds.length > 0) {
      options.embeds = embeds.map((url) => {
        return {
          url,
        };
      });
    }

    const { hash } = await client.publishCast(signerUuid, text, options);
    res.json({ hash });
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/channel", async (req, res) => {
  const { channel } = req.query;

  try {
    const data = await client.fetchFeedByChannelIds([channel], {
      limit: 50,
    });

    res.json(data);
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

app.get("/replies", async (req, res) => {
  const { hash } = req.query;

  try {
    const { conversation } = await client.lookupCastConversation(
      hash,
      CastParamType.Hash,
      {
        replyDepth: 2,
        includeChronologicalParentCasts: false,
        limit: 50,
      }
    );

    if (conversation && conversation.cast && conversation.cast.direct_replies) {
      const directReplies = conversation.cast.direct_replies;

      return res.status(200).json({ directReplies });
    } else {
      return res.status(404).json({ error: "No direct replies found" });
    }
  } catch (err) {
    console.error("Error fetching replies:", err);
    return res.status(500).json({ error: "Failed to fetch replies" });
  }
});

app.post("/reaction", async (req, res) => {
  const { signerUuid, hash, reaction } = req.body;

  const idempotencyKey = Math.random().toString(36).substring(16);

  try {
    await client.publishReactionToCast(signerUuid, reaction, hash, {
      idem: idempotencyKey,
    });

    return res.status(200).json({ message: "Reaction added successfully" });
  } catch (err) {
    console.error("Error adding reaction:", err);
    return res.status(500).json({ error: "Failed to add reaction" });
  }
});

app.post("/user/follow", async (req, res) => {
  const { signerUuid, followeeFid } = req.body;

  try {
    await client.followUser(signerUuid, [followeeFid]);

    return res.status(200).json({ message: "User followed successfully" });
  } catch (err) {
    console.error("Error following user:", err);
    return res.status(500).json({ error: "Failed to follow user" });
  }
});

app.post("/user/unfollow", async (req, res) => {
  const { signerUuid, followeeFid } = req.body;

  try {
    await client.unfollowUser(signerUuid, [followeeFid]);

    return res.status(200).json({ message: "User unfollowed successfully" });
  } catch (err) {
    console.error("Error unfollowing user:", err);
    return res.status(500).json({ error: "Failed to unfollow user" });
  }
});

app.get("/feed", async (req, res) => {
  try {
    const { channel, pageSize, fid, pageToken } = req.query;

    if (!channel || !pageSize) {
      return res.status(400).json({
        error: "Channel and pageSize are required query parameters",
      });
    }

    const params = new URLSearchParams();
    params.append("channel", channel);
    params.append("pageSize", pageSize);
    if (fid) params.append("fid", fid);
    if (pageToken) params.append("pageToken", pageToken);

    const url = `https://api.pinata.cloud/v3/farcaster/casts?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${PINATA_BEARER_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Pinata API error: ${response.statusText}`);
    }

    const data = await response.json();

    return res.status(200).json({
      data: data.casts,
      next: data.next,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/channel-feed", async (req, res) => {
  try {
    const { channel } = req.query;
    const url = `https://api.pinata.cloud/v3/farcaster/channels/${channel}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${PINATA_BEARER_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Pinata API error: ${response.statusText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/zora", async (req, res) => {
  const prisma = new PrismaClient();

  try {
    const zoraNfts = await prisma.zoraNft.findMany({
      select: {
        network: true,
        contract: true,
        tokenId: true,
        metadataUri: true,
        name: true,
        description: true,
      },
      orderBy: {
        id: "desc",
      },
      take: 15,
    });

    const formattedForFrontend = zoraNfts.map((nft) => {
      return {
        embeds: [
          {
            url: nft.metadataUri,
          },
        ],
        isZora: true,
        name: nft.name,
        description: nft.description,
        network: nft.network,
        contract: nft.contract,
        tokenId: nft.tokenId,
        hash: `${nft.contract}:${nft.tokenId}`,
      };
    });

    return res.status(200).json(formattedForFrontend);
  } catch (err) {
    console.error("Error fetching Zora NFTs:", err);
    return res.status(500).json({ error: "Failed to fetch Zora NFTs" });
  } finally {
    await prisma.$disconnect();
  }
});

app.post("/frame-action", async (req, res) => {
  const { frames_url, hash, post_url, button_index, action_type, signer_uuid } =
    req.body;

  const action = {
    button: {
      index: button_index,
      action_type: action_type,
    },
    frames_url: frames_url,
    post_url: post_url,
  };

  try {
    const frameRes = await client.postFrameAction(signer_uuid, hash, action);
    return res.status(200).json({ result: frameRes });
  } catch (err) {
    console.error("Error performing frame action:", err);
    return res.status(500).json({ error: "Failed to perform frame action" });
  }
});

app.get("/user-follows", async (req, res) => {
  const { fid, targetFid } = req.query;
  const fetch = (await import("node-fetch")).default;
  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=${targetFid}`;
    const options = {
      method: "GET",
      headers: { accept: "application/json", api_key: NEYNAR_API_KEY },
    };
    fetch(url, options)
      .then((res) => res.json())
      .then((json) => {
        res.status(200).json(json);
      })
      .catch((err) => console.error("error:" + err));
  } catch (error) {
    if (error.isAxiosError) {
      console.error("Error:", error);
      res.status(error.response.status).json({ error });
    } else {
      console.error("Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
