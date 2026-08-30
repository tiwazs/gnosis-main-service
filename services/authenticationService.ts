import { User } from "@prisma/client";
import { UserBaseDM } from "../dataModels/UserDataModel";
import { Encryptor } from "../lib/encryptor";
import prisma from '../configurations/dbinit';
import { UserService } from "./userService";
import jwt from "jsonwebtoken";
import logger from "../lib/logger";

export class AuthenticationService {

    static async login(email: string, password: string) {
        if(!email || !password) { throw new Error("Username and password are required"); }

        const user = await UserService.getEmail(email);
        if (!user) { throw new Error("User not found");}

        if (!user.password) { throw new Error("Login Method not allowed. user had not set a password");}
        
        // Matching password
        if( !(await Encryptor.matchPassword(password, user.password!)) ){ throw new Error("Invalid Credentials"); }
        
        logger.debug( `Password matched` );
        const token = this.signToken(user.id, email);
        logger.debug( `Token generated: ${token}` );
        
        // Appends the token to the response | Weird casting from moongoose object to JSON
        let userJson = JSON.parse(JSON.stringify(user));
        userJson.token = token;

        return userJson;
    }

    static async register(user: UserBaseDM): Promise<User> {
        const encryptPassword:string = await Encryptor.encryptPassword(user.password);

        // Ecrpt the password
        user.password = encryptPassword;

        const userCreated = await prisma.user.create({
            data: {
                ...user
            }
        });

        return userCreated;
    }

    static signToken(userId: string, email: string): string {
        return jwt.sign(
            { userId, email },
            process.env.TOKEN_KEY!,
            { expiresIn: "1h" }
        );
    }

    static async issueTokenForUser(userId: string): Promise<{ token: string; userId: string; email: string }> {
        const user = await UserService.getById(userId);
        if (!user) { throw new Error("User not found"); }
        const email = user.email ?? "";
        return {
            token: this.signToken(user.id, email),
            userId: user.id,
            email,
        };
    }

}