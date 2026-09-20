from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    is_admin: bool


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=1024)
    new_password: str = Field(min_length=8, max_length=1024)
