from pydantic import BaseModel, EmailStr, Field, model_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    accepted_terms: bool = False

    @model_validator(mode="after")
    def validate_terms(self) -> "RegisterRequest":
        if not self.accepted_terms:
            raise ValueError("Terms and privacy policy must be accepted")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6)
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


class AuthResponse(TokenResponse):
    user: UserRead
