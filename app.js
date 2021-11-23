const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

module.exports = app;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  console.log(`${name},${username},${password},${gender}`);
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (request.body.password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (name,username, password, gender) 
      VALUES 
        (
          '${name}', 
          '${username}', 
          '${hashedPassword}',
          '${gender}'
        )`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUserId = await db.get(getUserId);
  console.log(dbUserId);
  const { user_id } = dbUserId;
  const getNames = `SELECT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id WHERE follower.follower_user_id = ${user_id};`;
  const dbResponse = await db.all(getNames);
  response.send(dbResponse);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUserId = await db.get(getUserId);
  console.log(dbUserId);
  const { user_id } = dbUserId;
  const getNames = `SELECT name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id WHERE follower.following_user_id = ${user_id};`;
  const dbResponse = await db.all(getNames);
  response.send(dbResponse);
});

const convertDBResponseToObjectResponse = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUserId = await db.get(getUserId);
  console.log(dbUserId);
  const { user_id } = dbUserId;
  const getUsers = `SELECT user.username,tweet.tweet,tweet.date_time FROM user INNER JOIN follower ON user.user_id = follower.following_user_id 
  INNER JOIN tweet ON tweet.user_id = user.user_id WHERE follower.follower_user_id = ${user_id} ORDER BY date_time DESC LIMIT 4;`;
  const dbResponse = await db.all(getUsers);
  response.send(
    dbResponse.map((eachObject) =>
      convertDBResponseToObjectResponse(eachObject)
    )
  );
});

const dbResponseToObjectResponse = (likesData, repliesData) => {
  return {
    tweet: likesData.tweet,
    likes: likesData.likes,
    replies: repliesData.replies,
    dateTime: likesData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  console.log(tweetId);
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUserId = await db.get(getUserId);
  console.log(dbUserId);
  const { user_id } = dbUserId;
  console.log(user_id);
  const getIds = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUserId.user_id};`;
  const dbResponse = await db.all(getIds);
  console.log(dbResponse);
  const getFollowingIds = dbResponse.map((eachFollower) => {
    return eachFollower.following_user_id;
  });
  console.log(getFollowingIds);
  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  console.log(getTweetIdsArray);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  console.log(followingTweetIds);

  if (followingTweetIds.includes(parseInt(tweetId))) {
    const getLikes = `SELECT COUNT(like.tweet_id) AS likes,tweet.tweet,tweet.date_time FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id WHERE tweet.tweet_id = ${tweetId};`;
    const getLikesResponse = await db.get(getLikes);
    //response.send(getLikesResponse);
    const getReplies = `SELECT COUNT(tweet_id) AS replies FROM reply WHERE tweet_id = ${tweetId};`;
    const getRepliesResponse = await db.get(getReplies);
    //response.send(getRepliesResponse);
    response.send(
      dbResponseToObjectResponse(getLikesResponse, getRepliesResponse)
    );
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    const { username } = request;
    console.log(username);
    const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUserId = await db.get(getUser);
    console.log(dbUserId);
    const getFollowingUserIds = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUserId.user_id};`;
    const dbResponseGetIds = await db.all(getFollowingUserIds);
    console.log(dbResponseGetIds);
    const followingUserIdsArray = dbResponseGetIds.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(followingUserIdsArray);
    const getTweetIds = `SELECT tweet_id FROM tweet WHERE user_id IN (${followingUserIdsArray});`;
    const getDbUserIds = await db.all(getTweetIds);
    console.log(getDbUserIds);
    const getTweetIdsArray = getDbUserIds.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getTweetIdsArray);
    if (getTweetIdsArray.includes(parseInt(tweetId))) {
      const getUsernames = `SELECT username FROM user INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};`;
      const dbResponse = await db.all(getUsernames);
      const getNamesArray = dbResponse.map((eachName) => {
        return eachName.username;
      });
      console.log(getNamesArray);
      response.send({
        likes: getNamesArray,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    const { username } = request;
    console.log(username);
    const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUserId = await db.get(getUser);
    console.log(dbUserId);
    const getFollowingUserIds = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUserId.user_id};`;
    const dbResponseGetIds = await db.all(getFollowingUserIds);
    console.log(dbResponseGetIds);
    const followingUserIdsArray = dbResponseGetIds.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(followingUserIdsArray);
    const getTweetIds = `SELECT tweet_id FROM tweet WHERE user_id IN (${followingUserIdsArray});`;
    const getDbUserIds = await db.all(getTweetIds);
    console.log(getDbUserIds);
    const getTweetIdsArray = getDbUserIds.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getTweetIdsArray);
    if (getTweetIdsArray.includes(parseInt(tweetId))) {
      const getReplies = `SELECT user.name,reply.reply FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE reply.tweet_id = ${tweetId};`;
      const dbResponse = await db.all(getReplies);
      response.send({ replies: dbResponse });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

const dbResponseToObjectResponse1 = (dbObject) => {
  return {
    tweet: dbObject.tweet,
    likes: dbObject.likes,
    replies: dbObject.replies,
    dateTime: dbObject.date_time,
  };
};

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserId);
  //const getLikes = `SELECT tweet.tweet,COUNT(like.like_id) AS likes,tweet.date_time FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id WHERE tweet.user_id = ${dbUser.user_id} GROUP BY tweet.tweet;`;
  //const getLikesDbResponse = await db.all(getLikes);
  //response.send(getLikesDbResponse);
  //const getReplies = `SELECT COUNT(reply.reply_id) AS replies,tweet.tweet FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id WHERE tweet.user_id = ${dbUser.user_id} GROUP BY tweet.tweet;`;
  //const getRepliesDbResponse = await db.all(getReplies);
  //response.send(getRepliesDbResponse);
  const getTweets = `SELECT tweet.tweet,COUNT(DISTINCT like.like_id) AS likes,COUNT(DISTINCT reply.reply_id) as replies,tweet.date_time FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id WHERE tweet.user_id = ${dbUser.user_id} GROUP BY tweet.tweet_id;`;
  const dbResponse = await db.all(getTweets);
  response.send(
    dbResponse.map((eachObject) => dbResponseToObjectResponse1(eachObject))
  );
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  console.log(username);
  const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserId);
  const addTweet = `INSERT INTO tweet(tweet) VALUES ('${tweet}');`;
  await db.run(addTweet);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    console.log(username);
    const getUserId = `SELECT user_id FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(getUserId);
    const getTweetIds = `SELECT tweet_id from tweet WHERE user_id = ${dbUser.user_id}`;
    const getDbResponseTweetIds = await db.all(getTweetIds);
    console.log(getDbResponseTweetIds);
    const getTweetIdsArray = getDbResponseTweetIds.map((eachObject) => {
      return eachObject.tweet_id;
    });
    console.log(getTweetIdsArray);
    if (getTweetIdsArray.includes(parseInt(tweetId))) {
      const deleteTweet = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweet);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
