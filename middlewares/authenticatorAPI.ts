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
        const token = tokenBearer.split("Bearer ")[1];
        const decoded = await UserService.getByApiKey(token);
        
        logger.info( `authenticator: token validated` );
        req.user = decoded;
        return next();
    } catch ( error:any ) {

        logger.error({error: error.message});
        return res.status(401).send({error: error.message});
    }
}

export default authenticatorAPI;
