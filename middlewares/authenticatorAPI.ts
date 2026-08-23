import jwt from "jsonwebtoken";
import logger from '../lib/logger';
import { Response } from "express";
import { RequestWithUser } from "../dataModels/AuthenticationModels";
import { UserService } from "../services/userService";

const authenticatorAPI = async (req:RequestWithUser, res:Response, next: () => any) => {
    const tokenBearer = req.body.token || req.query.token || req.headers["x-access-token"] || req.headers["authorization"];

    if(!tokenBearer) {
        logger.info( `authenticator: no token found` );
        return res.status(401).send({error: "A token is required for authentication"});
    }
    try {
        const token = tokenBearer.startsWith("Bearer ")
            ? tokenBearer.slice("Bearer ".length)
            : tokenBearer;
        const decoded = await UserService.getByApiKey(token);
        if (!decoded) {
            logger.warn(`authenticator: invalid API key path=${req.path} authHeaderPresent=${Boolean(req.headers["authorization"])} keyLen=${token ? String(token).length : 0}`);
            return res.status(401).send({error: "Invalid API key"});
        }
        
        logger.info(`authenticator: token validated userId=${decoded.id} path=${req.path}`);
        req.user = decoded;
        return next();
    } catch ( error:any ) {

        logger.error({error: error.message});
        return res.status(401).send({error: error.message});
    }
}

export default authenticatorAPI;